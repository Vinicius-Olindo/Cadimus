// ==========================================
// crypto.js - Hash e verificação de senhas (PBKDF2 / Web Crypto)
// ==========================================
// Formato armazenado no banco: "iteracoes:saltHex:hashHex"

const ITERACOES = 100000;
const TAMANHO_HASH_BYTES = 32; // 256 bits

function bufferParaHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexParaBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Comparação em tempo constante para evitar timing attacks
function comparacaoSegura(a, b) {
  if (a.length !== b.length) return false;
  let resultado = 0;
  for (let i = 0; i < a.length; i++) {
    resultado |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return resultado === 0;
}

async function derivarBits(senha, saltBytes, iteracoes) {
  const encoder = new TextEncoder();
  const chaveBase = await crypto.subtle.importKey("raw", encoder.encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: iteracoes, hash: "SHA-256" },
    chaveBase,
    TAMANHO_HASH_BYTES * 8,
  );
  return bufferParaHex(bits);
}

export async function hashSenha(senha) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await derivarBits(senha, saltBytes, ITERACOES);
  const saltHex = bufferParaHex(saltBytes.buffer);
  return `${ITERACOES}:${saltHex}:${hashHex}`;
}

export async function verificarSenha(senha, hashArmazenado) {
  if (!hashArmazenado || typeof hashArmazenado !== "string") return false;

  const partes = hashArmazenado.split(":");
  if (partes.length !== 3) return false;

  const [iteracoesStr, saltHex, hashHex] = partes;
  const iteracoes = parseInt(iteracoesStr, 10);
  if (!Number.isFinite(iteracoes) || iteracoes <= 0) return false;

  const saltBytes = hexParaBytes(saltHex);
  const hashCalculadoHex = await derivarBits(senha, saltBytes, iteracoes);

  return comparacaoSegura(hashCalculadoHex, hashHex);
}
