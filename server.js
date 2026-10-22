const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const tls = require("tls");

cargarEnv(path.join(__dirname, ".env"));

const PUERTO = Number(process.env.PORT) || 3000;
const CLAVE_API = (process.env.MEALDB_API_KEY || "").trim();
const ARCHIVO_USUARIOS = path.join(__dirname, "data", "usuarios.json");
const PUBLICO = path.resolve(__dirname, "public");

const CATEGORIAS = {
  Beef: "Res",
  Chicken: "Pollo",
  Dessert: "Postre",
  Lamb: "Cordero",
  Miscellaneous: "Varios",
  Pasta: "Pasta",
  Pork: "Cerdo",
  Seafood: "Mariscos",
  Side: "Guarnición",
  Starter: "Entrada",
  Vegan: "Vegano",
  Vegetarian: "Vegetariano",
  Breakfast: "Desayuno",
  Goat: "Cabra",
};

const AREAS = {
  American: "Estadounidense",
  "United States": "Estadounidense",
  USA: "Estadounidense",
  Australian: "Australiana",
  Australia: "Australia",
  Argentinian: "Argentina",
  Argentina: "Argentina",
  Brazilian: "Brasileña",
  Brazil: "Brasil",
  British: "Británica",
  "United Kingdom": "Británica",
  Cambodian: "Camboyana",
  Canadian: "Canadiense",
  Chinese: "China",
  Croatian: "Croata",
  Dutch: "Neerlandesa",
  Egyptian: "Egipcia",
  Filipino: "Filipina",
  French: "Francesa",
  Greek: "Griega",
  Indian: "India",
  Irish: "Irlandesa",
  Italian: "Italiana",
  Jamaican: "Jamaicana",
  Japanese: "Japonesa",
  Kenyan: "Keniata",
  Malaysian: "Malaya",
  Mexican: "Mexicana",
  Moroccan: "Marroquí",
  Norwegian: "Noruega",
  Norway: "Noruega",
  Polish: "Polaca",
  Portuguese: "Portuguesa",
  Russian: "Rusa",
  Spanish: "Española",
  Thai: "Tailandesa",
  Tunisian: "Tunecina",
  Turkish: "Turca",
  Ukrainian: "Ucraniana",
  Unknown: "Sin región",
  Vietnamese: "Vietnamita",
};

const TEXTO_A_CATEGORIA = {
  pollo: "Chicken",
  res: "Beef",
  carne: "Beef",
  cerdo: "Pork",
  mariscos: "Seafood",
  pasta: "Pasta",
  postre: "Dessert",
  postres: "Dessert",
  vegetariano: "Vegetarian",
  vegano: "Vegan",
  desayuno: "Breakfast",
};

const PALABRA = {
  pollo: "chicken",
  res: "beef",
  carne: "beef",
  cerdo: "pork",
  pescado: "fish",
  mariscos: "seafood",
  pasta: "pasta",
  postre: "dessert",
  postres: "dessert",
  chocolate: "chocolate",
  pastel: "cake",
  tarta: "cake",
  arroz: "rice",
  sopa: "soup",
  ensalada: "salad",
  camaron: "shrimp",
  camarón: "shrimp",
  camarones: "shrimp",
  huevo: "egg",
  queso: "cheese",
  papa: "potato",
  patata: "potato",
  tomate: "tomato",
  curry: "curry",
  fideos: "noodle",
  desayuno: "breakfast",
  vegetariano: "vegetarian",
  vegano: "vegan",
};

const VACIAS = new Set(["con", "de", "la", "el", "los", "las", "y", "al", "a", "en", "una", "un", "del"]);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

const POLITICA =
  "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://www.themealdb.com https://themealdb.com; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'";

function cargarEnv(archivo) {
  if (!fs.existsSync(archivo)) return;
  const lineas = fs.readFileSync(archivo, "utf8").split(/\r?\n/);
  for (const linea of lineas) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#") || !limpia.includes("=")) continue;
    const corte = limpia.indexOf("=");
    const clave = limpia.slice(0, corte).trim();
    let valor = limpia.slice(corte + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (process.env[clave] == null) process.env[clave] = valor;
  }
}

function fallo(status, publico) {
  const error = new Error(publico);
  error.status = status;
  error.publico = publico;
  return error;
}

function cabecerasBase() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": POLITICA,
    "Cache-Control": "no-store",
  };
}

function enviarJson(res, status, cuerpo, extra) {
  const json = JSON.stringify(cuerpo);
  res.writeHead(status, {
    ...cabecerasBase(),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    ...(extra || {}),
  });
  res.end(json);
}

function enviarArchivo(res, archivo, status) {
  const ext = path.extname(archivo).toLowerCase();
  const cuerpo = fs.readFileSync(archivo);
  res.writeHead(status, {
    ...cabecerasBase(),
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": cuerpo.length,
  });
  res.end(cuerpo);
}

function resolverPublico(pathname) {
  let pedido = decodeURIComponent(pathname);
  if (pedido.includes("\0")) return null;
  if (pedido.endsWith("/")) pedido += "index.html";
  const relativo = pedido.replace(/^[/\\]+/, "");
  const absoluto = path.resolve(PUBLICO, relativo);
  if (absoluto !== PUBLICO && !absoluto.startsWith(PUBLICO + path.sep)) return null;
  if (fs.existsSync(absoluto) && fs.statSync(absoluto).isFile()) return absoluto;
  if (!path.extname(absoluto)) {
    const conHtml = absoluto + ".html";
    if (fs.existsSync(conHtml) && fs.statSync(conHtml).isFile()) return conHtml;
  }
  return null;
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    let total = 0;
    let rechazado = false;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > 16 * 1024) {
        rechazado = true;
        reject(fallo(413, "La solicitud es demasiado grande."));
        req.destroy();
        return;
      }
      trozos.push(chunk);
    });
    req.on("end", () => {
      if (rechazado) return;
      if (!trozos.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(trozos).toString("utf8")));
      } catch {
        reject(fallo(400, "El cuerpo no es JSON válido."));
      }
    });
    req.on("error", () => reject(fallo(400, "No se pudo leer la solicitud.")));
  });
}

const intentos = new Map();
function registroLimitado(ip) {
  const ahora = Date.now();
  const ventana = 15 * 60 * 1000;
  const actual = intentos.get(ip);
  if (!actual || ahora - actual.desde > ventana) {
    intentos.set(ip, { n: 1, desde: ahora });
    return false;
  }
  actual.n += 1;
  return actual.n > 20;
}

function traducirCategoria(valor) {
  return CATEGORIAS[valor] || valor || "Receta";
}

function traducirArea(valor) {
  return AREAS[valor] || valor || "";
}

function urlPermitida(valor, dominios) {
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    const permitida = dominios.some((dominio) => host === dominio || host.endsWith(`.${dominio}`));
    return permitida ? url.href : "";
  } catch {
    return "";
  }
}

function resumenReceta(meal, categoriaForzada) {
  return {
    id: String(meal.idMeal || ""),
    nombre: meal.strMeal || "Receta",
    categoria: traducirCategoria(categoriaForzada || meal.strCategory),
    area: traducirArea(meal.strArea),
    imagen: urlPermitida(meal.strMealThumb, ["themealdb.com"]),
  };
}

function detalleReceta(meal) {
  const ingredientes = [];
  for (let i = 1; i <= 20; i += 1) {
    const nombre = String(meal[`strIngredient${i}`] || "").trim();
    const medida = String(meal[`strMeasure${i}`] || "").trim();
    if (nombre) ingredientes.push({ nombre, medida });
  }
  const pasos = String(meal.strInstructions || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea && !/^step\s+\d+\.?$/i.test(linea));

  return {
    ...resumenReceta(meal),
    instrucciones: pasos.join("\n\n"),
    pasos,
    ingredientes,
    video: urlPermitida(meal.strYoutube, ["youtube.com", "youtu.be"]),
    etiquetas: String(meal.strTags || "")
      .split(",")
      .map((etiqueta) => etiqueta.trim())
      .filter(Boolean),
  };
}

function certificadosSistema() {
  if (typeof tls.getCACertificates !== "function") return undefined;
  try {
    return tls.getCACertificates("system");
  } catch {
    return undefined;
  }
}

function pedirJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca: certificadosSistema(), timeout: 12000 }, (respuesta) => {
      const trozos = [];
      respuesta.on("data", (chunk) => trozos.push(chunk));
      respuesta.on("end", () => {
        if (respuesta.statusCode < 200 || respuesta.statusCode >= 300) {
          reject(fallo(502, "El servicio de recetas respondió con un error."));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(trozos).toString("utf8")));
        } catch {
          reject(fallo(502, "El servicio de recetas envió una respuesta ilegible."));
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", (error) => {
      if (error.publico) reject(error);
      else reject(fallo(502, "No se pudo conectar con el servicio de recetas."));
    });
  });
}

async function consultarMealDB(ruta) {
  if (!CLAVE_API) throw fallo(500, "Falta MEALDB_API_KEY en el archivo .env del servidor.");
  const url = `https://www.themealdb.com/api/json/v1/${encodeURIComponent(CLAVE_API)}/${ruta}`;
  return pedirJson(url);
}

async function porCategoria(categoria) {
  if (!Object.hasOwn(CATEGORIAS, categoria)) throw fallo(400, "Esa categoría no está disponible.");
  const data = await consultarMealDB(`filter.php?c=${encodeURIComponent(categoria)}`);
  return (data.meals || []).map((meal) => resumenReceta(meal, categoria));
}

async function sugeridas() {
  const grupos = ["Chicken", "Seafood", "Pasta", "Dessert"];
  const listas = await Promise.all(grupos.map((categoria) => porCategoria(categoria)));
  return listas.flatMap((lista) => lista.slice(0, 3));
}

function interpretarBusqueda(texto) {
  const limpio = texto.trim().toLowerCase();
  if (TEXTO_A_CATEGORIA[limpio]) return { categoria: TEXTO_A_CATEGORIA[limpio] };
  const termino = limpio
    .split(/\s+/)
    .filter((palabra) => !VACIAS.has(palabra))
    .map((palabra) => PALABRA[palabra] || palabra)
    .join(" ")
    .trim();
  return { termino: termino || texto.trim() };
}

async function buscarPorNombre(termino) {
  const data = await consultarMealDB(`search.php?s=${encodeURIComponent(termino)}`);
  return (data.meals || []).map((meal) => resumenReceta(meal));
}

function responderLista(res, recetas, aviso) {
  enviarJson(res, 200, {
    ok: true,
    fuente: "TheMealDB",
    total: recetas.length,
    recetas: recetas.slice(0, 12),
    aviso: recetas.length ? aviso || "" : "No hay recetas con esa búsqueda.",
  });
}

function limpiarTexto(valor, maximo) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximo);
}

function validarRegistro(cuerpo) {
  const errores = {};
  const nombre = limpiarTexto(cuerpo.nombre, 50);
  const correo = limpiarTexto(cuerpo.correo, 80).toLowerCase();
  const password = String(cuerpo.password ?? "");
  const confirmar = String(cuerpo.confirmar ?? "");

  if (!nombre) errores.nombre = "Escribe tu nombre.";
  else if (!/^[\p{L}][\p{L}\s'-]{1,49}$/u.test(nombre)) {
    errores.nombre = "Usa solo letras, espacios o guiones (de 2 a 50 caracteres).";
  }

  if (!correo) errores.correo = "Escribe tu correo.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    errores.correo = "Ese correo no tiene un formato válido.";
  }

  if (!password) errores.password = "Escribe una contraseña.";
  else if (password.length > 64 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
    errores.password = "Debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.";
  }

  if (!confirmar) errores.confirmar = "Vuelve a escribir la contraseña.";
  else if (password && confirmar !== password) errores.confirmar = "Las contraseñas no coinciden.";

  return { errores, datos: Object.keys(errores).length ? null : { nombre, correo, password } };
}

function leerUsuarios() {
  if (!fs.existsSync(ARCHIVO_USUARIOS)) return [];
  const datos = JSON.parse(fs.readFileSync(ARCHIVO_USUARIOS, "utf8"));
  return Array.isArray(datos) ? datos : [];
}

function guardarUsuarios(usuarios) {
  fs.mkdirSync(path.dirname(ARCHIVO_USUARIOS), { recursive: true });
  fs.writeFileSync(ARCHIVO_USUARIOS, JSON.stringify(usuarios, null, 2));
}

let cola = Promise.resolve();
function encolar(tarea) {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.then(
    () => {},
    () => {}
  );
  return resultado;
}

function enmascararCorreo(correo) {
  const partes = correo.split("@");
  if (partes.length !== 2) return "***";
  return `${partes[0].slice(0, 1)}***@${partes[1]}`;
}

function derivarClave(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 32, (error, hash) => (error ? reject(error) : resolve(hash)));
  });
}

async function rutaApi(req, res, url) {
  const ruta = url.pathname;

  if (req.method === "GET" && ruta === "/api/recetas/aleatoria") {
    const data = await consultarMealDB("random.php");
    const meal = data.meals && data.meals[0];
    if (!meal) throw fallo(502, "El servicio no devolvió una receta.");
    return enviarJson(res, 200, { ok: true, fuente: "TheMealDB", receta: detalleReceta(meal) });
  }

  if (req.method === "GET" && ruta === "/api/recetas") {
    const categoriaPedida = String(url.searchParams.get("categoria") || "").trim();
    const texto = String(url.searchParams.get("q") || "").trim().slice(0, 60);
    if (categoriaPedida) return responderLista(res, await porCategoria(categoriaPedida));
    if (texto) {
      const interpretacion = interpretarBusqueda(texto);
      if (interpretacion.categoria) return responderLista(res, await porCategoria(interpretacion.categoria));
      return responderLista(res, await buscarPorNombre(interpretacion.termino));
    }
    return responderLista(res, await sugeridas(), "Una mezcla de pollo, mariscos, pasta y postres.");
  }

  const detalle = ruta.match(/^\/api\/recetas\/(\d{1,8})$/);
  if (req.method === "GET" && detalle) {
    const data = await consultarMealDB(`lookup.php?i=${detalle[1]}`);
    const meal = data.meals && data.meals[0];
    if (!meal) throw fallo(404, "No encontramos esa receta.");
    return enviarJson(res, 200, { ok: true, fuente: "TheMealDB", receta: detalleReceta(meal) });
  }

  if (req.method === "POST" && ruta === "/api/registro") {
    const ip = req.socket.remoteAddress || "local";
    if (registroLimitado(ip)) {
      return enviarJson(
        res,
        429,
        { ok: false, mensaje: "Demasiados intentos de registro. Espera unos minutos y vuelve a probar." },
        { "Retry-After": "900" }
      );
    }

    const cuerpo = await leerCuerpo(req);
    const { errores, datos } = validarRegistro(cuerpo || {});
    if (Object.keys(errores).length) return enviarJson(res, 400, { ok: false, errores });

    const respuesta = await encolar(async () => {
      const usuarios = leerUsuarios();
      if (usuarios.some((usuario) => usuario.correo === datos.correo)) {
        return {
          status: 409,
          cuerpo: { ok: false, errores: { correo: "Ese correo ya tiene una cuenta." } },
        };
      }
      const salt = crypto.randomBytes(16);
      const hash = await derivarClave(datos.password, salt);
      usuarios.push({
        id: crypto.randomUUID(),
        nombre: datos.nombre,
        correo: datos.correo,
        passwordHash: `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`,
        creadoEn: new Date().toISOString(),
      });
      guardarUsuarios(usuarios);
      return {
        status: 201,
        cuerpo: {
          ok: true,
          mensaje:
            "Cuenta creada. La contraseña se guardó como hash scrypt y el texto plano no queda almacenado.",
          usuario: { nombre: datos.nombre, correo: datos.correo },
        },
      };
    });
    return enviarJson(res, respuesta.status, respuesta.cuerpo);
  }

  if (req.method === "GET" && ruta === "/api/seguridad") {
    let cuentas = 0;
    let ultimoRegistro = null;
    try {
      const usuarios = leerUsuarios();
      cuentas = usuarios.length;
      const ultimo = usuarios[usuarios.length - 1];
      if (ultimo) {
        ultimoRegistro = {
          nombre: ultimo.nombre,
          correo: enmascararCorreo(ultimo.correo),
          creadoEn: ultimo.creadoEn,
          password: "hash scrypt almacenado; no se muestra",
        };
      }
    } catch {
      cuentas = 0;
    }
    return enviarJson(res, 200, {
      ok: true,
      servicio: "Mesa Viva",
      apiExterna: "TheMealDB",
      claveEnElNavegador: false,
      claveConfigurada: Boolean(CLAVE_API),
      password: { algoritmo: "scrypt", textoPlanoGuardado: false },
      cuentas,
      ultimoRegistro,
    });
  }

  return enviarJson(res, 404, { ok: false, mensaje: "Ese recurso no existe." });
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) return await rutaApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") {
      return enviarJson(res, 405, { ok: false, mensaje: "Método no permitido." });
    }
    const archivo = resolverPublico(url.pathname);
    if (!archivo) return enviarArchivo(res, path.join(PUBLICO, "404.html"), 404);
    return enviarArchivo(res, archivo, 200);
  } catch (error) {
    if (res.writableEnded) return;
    enviarJson(res, error.status || 500, {
      ok: false,
      mensaje: error.publico || "Ocurrió un problema al atender la solicitud.",
    });
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Mesa Viva en http://localhost:${PUERTO}`);
  console.log(`Clave de TheMealDB cargada: ${CLAVE_API ? "sí" : "no"}`);
});
