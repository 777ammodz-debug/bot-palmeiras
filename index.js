const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');
const fs = require('fs');

const GRUPO_VERDAO = '120363413059034119@g.us';
const NOME_BOT = '🐷 VERDÃO BOT';
const DONO = 'VERDÃO';
const PALMEIRAS_ID = 1769;
const COMPETICAO_BRASILEIRAO = 'BSA';
const COMPETICAO_LIBERTADORES = 'CLI';
const TEMPORADA = 2026;
const CONFIG_PATH = './config.json';
const API_BASE = 'https://api.football-data.org/v4';

let API_TOKEN = '';
try {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  API_TOKEN = config.FOOTBALL_DATA_TOKEN || config.API_FUTEBOL_KEY || '';
} catch (erro) {
  console.error('⚠️ Não foi possível ler o config.json');
}

const cache = new Map();
function pegarCache(chave) {
  const item = cache.get(chave);
  if (!item) return null;
  if (Date.now() > item.expira) {
    cache.delete(chave);
    return null;
  }
  return item.dados;
}
function salvarCache(chave, dados, segundos) {
  cache.set(chave, { dados, expira: Date.now() + segundos * 1000 });
}

async function apiFootballData(endpoint, cacheKey, cacheSeconds = 60) {
  const salvo = pegarCache(cacheKey);
  if (salvo) return salvo;
  if (!API_TOKEN) throw new Error('Token da API não encontrado no config.json');

  const resposta = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': API_TOKEN }
  });
  const texto = await resposta.text();
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(`Resposta inválida da API. HTTP ${resposta.status}`);
  }
  if (!resposta.ok) {
    throw new Error(dados?.message || `Erro da API. HTTP ${resposta.status}`);
  }
  salvarCache(cacheKey, dados, cacheSeconds);
  return dados;
}

function extrairTexto(msg) {
  const m = msg?.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ''
  ).trim();
}

async function enviar(sock, jid, texto, msg = null, opcoes = {}) {
  const conteudo = { text: texto, ...opcoes };
  if (msg?.key) {
    await sock.sendMessage(jid, conteudo, { quoted: msg });
  } else {
    await sock.sendMessage(jid, conteudo);
  }
}

const MIDIA_DIR = './midias';
const IMAGENS = {
  menu: `${MIDIA_DIR}/menu.png`,
  entrada: `${MIDIA_DIR}/entrada.png`,
  saida: `${MIDIA_DIR}/saida.png`,
  voltou: `${MIDIA_DIR}/voltou.png`,
  regras: `${MIDIA_DIR}/regras.png`
};

async function enviarComImagem(sock, jid, imagem, legenda, msg = null, mentions = []) {
  const opcoes = {
    image: fs.readFileSync(imagem),
    caption: legenda
  };
  if (mentions?.length) opcoes.mentions = mentions;
  if (msg?.key) {
    await sock.sendMessage(jid, opcoes, { quoted: msg });
  } else {
    await sock.sendMessage(jid, opcoes);
  }
}

function imagemDisponivel(caminho) {
  return fs.existsSync(caminho);
}

function formatarData(utcDate) {
  if (!utcDate) return 'Data não informada';
  return new Date(utcDate).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}
function formatarDia(utcDate) {
  if (!utcDate) return '--/--';
  return new Date(utcDate).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit'
  });
}
function traduzirPosicao(posicao) {
  const mapa = {
    Goalkeeper: 'Goleiro', Defence: 'Defesa', Midfield: 'Meio-campo',
    Offence: 'Ataque', 'Centre-Forward': 'Centroavante',
    'Attacking Midfield': 'Meia-atacante', 'Left Winger': 'Ponta esquerda',
    'Right Winger': 'Ponta direita', 'Defensive Midfield': 'Volante',
    'Central Midfield': 'Meia', 'Left-Back': 'Lateral esquerdo',
    'Right-Back': 'Lateral direito', 'Centre-Back': 'Zagueiro'
  };
  return mapa[posicao] || posicao || 'Posição não informada';
}
function nomeTime(time) {
  return time?.shortName || time?.name || 'Time desconhecido';
}

const MENU_PRINCIPAL = `
╭━━━〔 🐷 𝗩𝗘𝗥𝗗Ã𝗢 𝗕𝗢𝗧 〕━━━╮
┃     🟢 𝗖𝗘𝗡𝗧𝗥𝗔𝗟 𝗣𝗔𝗟𝗠𝗘𝗜𝗥𝗔𝗦
╰━━━━━━━━━━━━━━━━━━━━━━╯

⚽ 𝗝𝗢𝗚𝗢𝗦
› /pj — Próximo jogo
› /cal — Calendário
› /res — Resultados
› /esc — Escalação
› /class — Classificação

🏆 𝗖𝗢𝗠𝗣𝗘𝗧𝗜ÇÕ𝗘𝗦
› /bra — Brasileirão
› /lib — Libertadores
› /cdb — Copa do Brasil
› /mun — Mundial

👥 𝗘𝗟𝗘𝗡𝗖𝗢
› /el — Elenco
› /jog — Jogadores
› /art — Artilheiros
› /stats — Estatísticas

📰 𝗜𝗡𝗙𝗢𝗥𝗠𝗔ÇÕ𝗘𝗦
› /not — Notícias
› /merc — Mercado
› /cont — Contratações
› /sai — Saídas

🏟️ 𝗖𝗟𝗨𝗕𝗘
› /ali — Allianz Parque
› /hist — História
› /tit — Títulos
› /pal — Sobre o Palmeiras

🔔 𝗔𝗟𝗘𝗥𝗧𝗔𝗦
› /alertas — Central de alertas
› /configalertas — Configurar alertas

📜 𝗚𝗥𝗨𝗣𝗢
› /regra — Regras do grupo
› /adm — Painel da administração

━━━━━━━━━━━━━━━━━━━━━━
💚 𝗔𝗩𝗔𝗡𝗧𝗜 𝗣𝗔𝗟𝗘𝗦𝗧𝗥𝗔! 🐷
`;

const MENU_JOGOS = `
╭━━━〔 ⚽ 𝗝𝗢𝗚𝗢𝗦 〕━━━╮

› /pj — Próximo jogo
› /cal — Calendário
› /res — Resultados
› /esc — Escalação
› /class — Classificação

╰━━━━━━━━━━━━━━━━━━━━╯`;
const MENU_COMPETICOES = `
╭━━━〔 🏆 𝗖𝗢𝗠𝗣𝗘𝗧𝗜ÇÕ𝗘𝗦 〕━━━╮

› /bra — Brasileirão
› /lib — Libertadores
› /cdb — Copa do Brasil
› /mun — Mundial

╰━━━━━━━━━━━━━━━━━━━━━━━━╯`;
const MENU_ELENCO = `
╭━━━〔 👥 𝗘𝗟𝗘𝗡𝗖𝗢 〕━━━╮

› /el — Elenco
› /jog — Jogadores
› /art — Artilheiros
› /stats — Estatísticas

╰━━━━━━━━━━━━━━━━━━━━╯`;
const MENU_NOTICIAS = `
╭━━━〔 📰 𝗜𝗡𝗙𝗢𝗥𝗠𝗔ÇÕ𝗘𝗦 〕━━━╮

› /not — Notícias
› /merc — Mercado
› /cont — Contratações
› /sai — Saídas

╰━━━━━━━━━━━━━━━━━━━━━━╯`;
const MENU_CLUBE = `
╭━━━〔 🏟️ 𝗖𝗟𝗨𝗕𝗘 〕━━━╮

› /ali — Allianz Parque
› /hist — História
› /tit — Títulos
› /pal — Sobre o Palmeiras

╰━━━━━━━━━━━━━━━━━━━━╯`;
const MENU_ALERTAS = `
╭━━━〔 🔔 𝗔𝗟𝗘𝗥𝗧𝗔𝗦 〕━━━╮

› /alertas — Central de alertas
› /configalertas — Configurar alertas

╰━━━━━━━━━━━━━━━━━━━━╯`;

const REGRAS_GRUPO = `
╭━━━〔 💚🐷 𝗣𝗔𝗟𝗠𝗘𝗜𝗥𝗔𝗦 🐷💚 〕━━━╮
┃     𝗕𝗘𝗠-𝗩𝗜𝗡𝗗𝗢𝗦 𝗔𝗢 𝗚𝗥𝗨𝗣𝗢!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🟢 Seja bem-vindo ao grupo da torcida do Verdão!

⚽ Aqui é o espaço para falar sobre o Palmeiras, comentar jogos, compartilhar notícias, acompanhar as novidades e representar o Verdão. 💚🐷

━━━━━━━━━━━━━━━━━━━━━━
📜 𝗥𝗘𝗚𝗥𝗔𝗦 𝗗𝗢 𝗚𝗥𝗨𝗣𝗢
━━━━━━━━━━━━━━━━━━━━━━

🚫 Links sem autorização — 𝗕𝗔𝗡
🔞 Figurinhas ou conteúdo +18 — 𝗕𝗔𝗡
🚫 Ofensas, preconceito ou desrespeito — 𝗕𝗔𝗡
🚫 Spam, flood ou correntes — 𝗕𝗔𝗡
🚫 Brigas ou provocações excessivas — 𝗕𝗔𝗡

━━━━━━━━━━━━━━━━━━━━━━

✅ Respeite todos os membros.
✅ Mantenha a zoeira saudável.
✅ Divulgações somente com autorização da administração.
✅ Mantenha o foco no futebol e no Palmeiras.
✅ Respeite as decisões dos administradores.

⚠️ 𝗔𝗧𝗘𝗡ÇÃ𝗢: regras marcadas com 𝗕𝗔𝗡 podem resultar em banimento imediato, sem aviso prévio.

━━━━━━━━━━━━━━━━━━━━━━
💚🤍 𝗔𝗤𝗨𝗜 É 𝗣𝗔𝗟𝗠𝗘𝗜𝗥𝗔𝗦! 🤍💚
🐷 𝗔𝗩𝗔𝗡𝗧𝗜 𝗣𝗔𝗟𝗘𝗦𝗧𝗥𝗔! 🐷`;

const MENU_ADMIN = `
╭━━━〔 👑 𝗣𝗔𝗜𝗡𝗘𝗟 𝗔𝗗𝗠𝗜𝗡 〕━━━╮
┃      🐷 𝗩𝗘𝗥𝗗Ã𝗢 𝗕𝗢𝗧
╰━━━━━━━━━━━━━━━━━━━━━━╯

🛡️ 𝗠𝗢𝗗𝗘𝗥𝗔ÇÃ𝗢
› /ban — Banir membro marcado/respondido
› /kick — Remover membro do grupo
› /promover — Dar administrador
› /rebaixar — Remover administrador
› /apagar — Apagar mensagem respondida

🔒 𝗖𝗢𝗡𝗧𝗥𝗢𝗟𝗘 𝗗𝗢 𝗚𝗥𝗨𝗣𝗢
› /fechar — Somente admins podem enviar
› /abrir — Liberar mensagens para todos
› /linkgrupo — Gerar link do grupo

📋 𝗜𝗡𝗙𝗢𝗥𝗠𝗔ÇÕ𝗘𝗦
› /status — Status do bot
› /idgrupo — ID do grupo
› /dono — Dono do bot
› /regra — Regras do grupo

⚙️ 𝗦𝗜𝗦𝗧𝗘𝗠𝗔
› /menu — Painel principal
› /adm — Este painel

━━━━━━━━━━━━━━━━━━━━━━
🔐 Acesso exclusivo para administradores.
╰━━━━━━━━━━━━━━━━━━━━━━╯`;


const MENSAGEM_DESENVOLVIMENTO = (nome = 'Esta função') => `
╭━━━〔 🛠️ 𝗘𝗠 𝗗𝗘𝗦𝗘𝗡𝗩𝗢𝗟𝗩𝗜𝗠𝗘𝗡𝗧𝗢 〕━━━╮

🔧 ${nome} está em desenvolvimento.

📅 O comando será liberado nas próximas atualizações do 𝗩𝗘𝗥𝗗Ã𝗢 𝗕𝗢𝗧.

⚠️ Para não inventar informações, esta função ainda não exibe dados.

💚🐷 𝗔𝗩𝗔𝗡𝗧𝗜 𝗣𝗔𝗟𝗘𝗦𝗧𝗥𝗔!
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

async function obterProximoJogo() {
  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}/matches?season=${TEMPORADA}&status=SCHEDULED&limit=10`,
    'proximo-jogo', 120
  );
  const jogos = dados.matches || [];
  if (!jogos.length) return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ ⚽ *PRÓXIMO JOGO*
╰━━━━━━━━━━━━━━━━━━━━╯

📅 Nenhum próximo jogo encontrado.

💚 *VERDÃO BOT*
`;
  const jogo = jogos.sort((a,b) => new Date(a.utcDate)-new Date(b.utcDate))[0];
  return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ ⚽ *PRÓXIMO JOGO*
╰━━━━━━━━━━━━━━━━━━━━╯

🏆 *${jogo.competition?.name || 'Competição'}*

🏠 ${nomeTime(jogo.homeTeam)}
🆚
✈️ ${nomeTime(jogo.awayTeam)}

📅 ${formatarData(jogo.utcDate)}

${jogo.stage ? `🎯 Fase: ${jogo.stage}` : ''}

━━━━━━━━━━━━━━━━━━━━
🐷 *PALMEIRAS*
💚 *AVANTI PALESTRA!*
`;
}

async function obterCalendario() {
  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}/matches?season=${TEMPORADA}&limit=20`,
    'calendario-palmeiras', 180
  );
  const proximos = (dados.matches || [])
    .filter(j => j.status === 'SCHEDULED')
    .sort((a,b) => new Date(a.utcDate)-new Date(b.utcDate))
    .slice(0,10);
  if (!proximos.length) return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📅 *CALENDÁRIO*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum próximo jogo encontrado.
`;
  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📅 *CALENDÁRIO*
╰━━━━━━━━━━━━━━━━━━━━╯
`;
  proximos.forEach((jogo,index) => {
    texto += `

*${index+1}.* ${formatarDia(jogo.utcDate)}
🏆 ${jogo.competition?.name || 'Competição'}
⚽ ${nomeTime(jogo.homeTeam)} x ${nomeTime(jogo.awayTeam)}`;
  });
  return texto + `

━━━━━━━━━━━━━━━━━━━━
🐷 *VERDÃO BOT*`;
}

async function obterResultados() {
  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}/matches?season=${TEMPORADA}&status=FINISHED&limit=10`,
    'resultados-palmeiras', 180
  );
  const jogos = dados.matches || [];
  if (!jogos.length) return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📊 *RESULTADOS*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum resultado encontrado.
`;
  const recentes = jogos.sort((a,b) => new Date(a.utcDate)-new Date(b.utcDate)).slice(-10).reverse();
  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📊 *ÚLTIMOS RESULTADOS*
╰━━━━━━━━━━━━━━━━━━━━╯
`;
  recentes.forEach((jogo,index) => {
    const casa = jogo.score?.fullTime?.home;
    const fora = jogo.score?.fullTime?.away;
    const placar = casa != null && fora != null ? `${casa} x ${fora}` : 'x';
    texto += `

*${index+1}.* ${formatarDia(jogo.utcDate)}
🏆 ${jogo.competition?.name || 'Competição'}
⚽ ${nomeTime(jogo.homeTeam)} *${placar}* ${nomeTime(jogo.awayTeam)}`;
  });
  return texto + `

━━━━━━━━━━━━━━━━━━━━
🐷 *PALMEIRAS*`;
}

async function obterClassificacao() {
  const dados = await apiFootballData(
    `/competitions/${COMPETICAO_BRASILEIRAO}/standings?season=${TEMPORADA}`,
    'classificacao-brasileirao', 180
  );
  const tabela = dados.standings?.find(s => s.type === 'TOTAL') || dados.standings?.[0];
  const times = tabela?.table || [];
  if (!times.length) return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏆 *CLASSIFICAÇÃO*
╰━━━━━━━━━━━━━━━━━━━━╯

Não foi possível carregar a tabela.
`;
  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🇧🇷 *BRASILEIRÃO 2026*
╰━━━━━━━━━━━━━━━━━━━━╯

`;
  times.forEach(time => {
    texto += `${String(time.position).padStart(2,'0')}º ${time.team.shortName || time.team.name} — ${time.points} pts\n`;
  });
  const palmeiras = times.find(t => t.team.id === PALMEIRAS_ID);
  return texto + `
━━━━━━━━━━━━━━━━━━━━
🐷 *PALMEIRAS: ${palmeiras?.position || '-'}º*`;
}

async function obterBrasileirao() {
  const dados = await apiFootballData(
    `/competitions/${COMPETICAO_BRASILEIRAO}/standings?season=${TEMPORADA}`,
    'brasileirao-info', 180
  );
  const tabela = dados.standings?.find(s => s.type === 'TOTAL') || dados.standings?.[0];
  const palmeiras = tabela?.table?.find(t => t.team.id === PALMEIRAS_ID);
  return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🇧🇷 *BRASILEIRÃO 2026*
╰━━━━━━━━━━━━━━━━━━━━╯

🏆 Campeonato Brasileiro Série A

📅 Rodada atual:
*${dados.season?.currentMatchday || '-'}*

🐷 *PALMEIRAS*

📍 Posição: *${palmeiras?.position || '-'}º*
🎮 Jogos: *${palmeiras?.playedGames || '-'}*
✅ Vitórias: *${palmeiras?.won || '-'}*
🤝 Empates: *${palmeiras?.draw || '-'}*
❌ Derrotas: *${palmeiras?.lost || '-'}*

⚽ Gols marcados: *${palmeiras?.goalsFor || '-'}*
🛡️ Gols sofridos: *${palmeiras?.goalsAgainst || '-'}*
📊 Saldo: *${palmeiras?.goalDifference || '-'}*

🏆 Pontos: *${palmeiras?.points || '-'}*

━━━━━━━━━━━━━━━━━━━━
💚 *AVANTI PALESTRA!*`;
}

async function obterLibertadores() {
  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}/matches?season=${TEMPORADA}&competitions=${COMPETICAO_LIBERTADORES}&limit=20`,
    'libertadores-palmeiras', 180
  );
  const jogos = dados.matches || [];
  if (!jogos.length) return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🌎 *LIBERTADORES*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum jogo encontrado.
`;
  const proximos = jogos.filter(j=>j.status==='SCHEDULED').sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
  const resultados = jogos.filter(j=>j.status==='FINISHED').sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate)).slice(-5).reverse();
  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🌎 *LIBERTADORES 2026*
╰━━━━━━━━━━━━━━━━━━━━╯`;
  if (proximos.length) {
    texto += `\n\n⚽ *PRÓXIMOS JOGOS*`;
    proximos.slice(0,5).forEach(jogo => {
      texto += `\n\n📅 ${formatarDia(jogo.utcDate)}\n🏆 ${jogo.stage || 'Fase'}\n⚽ ${nomeTime(jogo.homeTeam)} x ${nomeTime(jogo.awayTeam)}`;
    });
  }
  if (resultados.length) {
    texto += `\n\n📊 *ÚLTIMOS RESULTADOS*`;
    resultados.forEach(jogo => {
      const casa=jogo.score?.fullTime?.home, fora=jogo.score?.fullTime?.away;
      texto += `\n\n📅 ${formatarDia(jogo.utcDate)}\n⚽ ${nomeTime(jogo.homeTeam)} *${casa ?? '-'} x ${fora ?? '-'}* ${nomeTime(jogo.awayTeam)}`;
      if (jogo.score?.penalties) texto += `\n🥅 Pênaltis: ${jogo.score.penalties.home} x ${jogo.score.penalties.away}`;
    });
  }
  return texto + `\n\n━━━━━━━━━━━━━━━━━━━━\n🐷 *PALMEIRAS*\n💚 *AVANTI PALESTRA!*`;
}

async function obterElenco() {
  const dados = await apiFootballData(`/teams/${PALMEIRAS_ID}`,'elenco-palmeiras',3600);
  const jogadores = dados.squad || [];
  if (!jogadores.length) return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👥 *ELENCO*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum jogador encontrado.
`;
  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👥 *ELENCO PALMEIRAS*
╰━━━━━━━━━━━━━━━━━━━━╯
`;
  const grupos = {'Goalkeeper':[],'Defence':[],'Midfield':[],'Offence':[],'Centre-Forward':[],'Attacking Midfield':[],'Left Winger':[],'Right Winger':[]};
  jogadores.forEach(j => { const pos=j.position||'Offence'; if(!grupos[pos]) grupos[pos]=[]; grupos[pos].push(j); });
  Object.keys(grupos).forEach(pos => {
    if(!grupos[pos].length) return;
    texto += `\n*${traduzirPosicao(pos).toUpperCase()}*\n`;
    grupos[pos].forEach(j => { texto += `• ${j.name}\n`; });
  });
  return texto + `\n━━━━━━━━━━━━━━━━━━━━\n🐷 *${jogadores.length} jogadores cadastrados*`;
}

async function obterJogadores() {
  const dados = await apiFootballData(`/teams/${PALMEIRAS_ID}`,'jogadores-palmeiras',3600);
  const jogadores = dados.squad || [];
  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👤 *JOGADORES*
╰━━━━━━━━━━━━━━━━━━━━╯
`;
  jogadores.forEach((j,index) => { texto += `\n*${index+1}.* ${j.name}\n   📌 ${traduzirPosicao(j.position)}\n`; });
  return texto + `\n━━━━━━━━━━━━━━━━━━━━\n🐷 *VERDÃO BOT*`;
}

async function obterArtilheiros() {
  const dados = await apiFootballData(`/competitions/${COMPETICAO_BRASILEIRAO}/scorers?season=${TEMPORADA}&limit=10`,'artilheiros-brasileirao',180);
  const artilheiros = dados.scorers || [];
  if (!artilheiros.length) return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🥅 *ARTILHEIROS*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum dado encontrado.
`;
  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🥅 *ARTILHEIROS*
┃ 🇧🇷 BRASILEIRÃO 2026
╰━━━━━━━━━━━━━━━━━━━━╯
`;
  artilheiros.forEach((j,index) => {
    texto += `\n*${index+1}º* ${j.player.name}\n   🏟️ ${j.team.shortName || j.team.name}\n   ⚽ ${j.goals || 0} gols`;
    if(j.assists != null) texto += ` | 🎯 ${j.assists} assist.`;
    texto += '\n';
  });
  return texto + `\n━━━━━━━━━━━━━━━━━━━━\n🐷 *VERDÃO BOT*`;
}

async function obterEstatisticas() {
  const dados = await apiFootballData(`/competitions/${COMPETICAO_BRASILEIRAO}/scorers?season=${TEMPORADA}&limit=100`,'stats-brasileirao',180);
  const palmeirenses = (dados.scorers || []).filter(j => j.team?.id === PALMEIRAS_ID);
  if (!palmeirenses.length) return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📈 *ESTATÍSTICAS*
╰━━━━━━━━━━━━━━━━━━━━╯

Ainda não encontrei estatísticas
individuais do Palmeiras no retorno
da API.
`;
  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📈 *PALMEIRAS*
┃ ESTATÍSTICAS 2026
╰━━━━━━━━━━━━━━━━━━━━╯
`;
  palmeirenses.sort((a,b)=>(b.goals||0)-(a.goals||0)).slice(0,10).forEach((j,index) => {
    texto += `\n*${index+1}.* ${j.player.name}\n⚽ Gols: ${j.goals||0}\n🎯 Assistências: ${j.assists||0}\n🎮 Jogos: ${j.playedMatches||0}\n`;
  });
  return texto + `\n━━━━━━━━━━━━━━━━━━━━\n💚 *AVANTI PALESTRA!*`;
}

async function obterPalmeiras() {
  const dados = await apiFootballData(`/teams/${PALMEIRAS_ID}`,'dados-palmeiras',3600);
  return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🐷 *PALMEIRAS*
╰━━━━━━━━━━━━━━━━━━━━╯

💚 *${dados.name || 'SE Palmeiras'}*

🏟️ Estádio:
*${dados.venue || 'Allianz Parque'}*

📍 ${dados.address || 'São Paulo - SP'}

📅 Fundação:
*${dados.founded || 1914}*

🎨 Cores:
*${dados.clubColors || 'Green / White'}*

👔 Técnico:
*${dados.coach?.name || 'Não informado'}*

👥 Elenco:
*${dados.squad?.length || 0} jogadores*

🏆 Competições:
${(dados.runningCompetitions || []).map(c=>`• ${c.name}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━
💚 *AVANTI PALESTRA!*`;
}

async function obterEscalacao() {
  return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👥 *ESCALAÇÃO*
╰━━━━━━━━━━━━━━━━━━━━╯

📡 A fonte atual fornece o elenco
e dados das partidas, mas não
garante a escalação titular para
cada próximo jogo.

⚠️ Por isso o VERDÃO BOT não vai
inventar uma escalação.

🔔 Quando houver uma fonte com
lineup disponível, essa função
poderá mostrar:

• Titulares
• Reservas
• Formação
• Técnico

━━━━━━━━━━━━━━━━━━━━
🐷 *VERDÃO BOT*`;
}

const INFORMACOES_FIXAS = {
  allianz: MENSAGEM_DESENVOLVIMENTO('O comando /ali (Allianz Parque)'),
  historia: MENSAGEM_DESENVOLVIMENTO('O comando /hist (História)'),
  titulos: MENSAGEM_DESENVOLVIMENTO('O comando /tit (Títulos)'),
  noticias: MENSAGEM_DESENVOLVIMENTO('O comando /not (Notícias)'),
  mercado: MENSAGEM_DESENVOLVIMENTO('O comando /merc (Mercado)'),
  contratacoes: MENSAGEM_DESENVOLVIMENTO('O comando /cont (Contratações)'),
  saidas: MENSAGEM_DESENVOLVIMENTO('O comando /sai (Saídas)'),
  copadobrasil: MENSAGEM_DESENVOLVIMENTO('O comando /cdb (Copa do Brasil)'),
  mundial: MENSAGEM_DESENVOLVIMENTO('O comando /mun (Mundial)'),
  alertas: MENSAGEM_DESENVOLVIMENTO('O comando /alertas'),
  configalertas: MENSAGEM_DESENVOLVIMENTO('O comando /configalertas')
};

function mensagemErroAPI(erro) {
  console.error('❌ ERRO API:', erro);
  return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ ⚠️ *ERRO DE DADOS*
╰━━━━━━━━━━━━━━━━━━━━╯

Não consegui carregar os dados
agora.

🔄 Tente novamente em alguns
segundos.

🐷 *VERDÃO BOT*`;
}

async function obterAlvo(sock, grupo, msg) {
  const mencionado = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  if (mencionado) return mencionado;
  const quoted = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const participant = msg?.message?.extendedTextMessage?.contextInfo?.participant;
  if (quoted && participant) return participant;
  return null;
}

function normalizarJid(jid = '') {
  return String(jid).replace(/:\d+(?=@)/, '');
}

async function ehAdmin(sock, grupo, jid) {
  try {
    const meta = await sock.groupMetadata(grupo);
    const alvo = normalizarJid(jid);
    return (meta.participants || []).some(p => normalizarJid(p.id) === alvo && (p.admin === 'admin' || p.admin === 'superadmin'));
  } catch {
    return false;
  }
}

async function executarAdmin(sock, grupo, msg, acao) {
  const remetente = msg?.key?.participant || msg?.participant || sock.user?.id || '';
  if (!(await ehAdmin(sock, grupo, remetente))) {
    await enviar(sock, grupo, '🔒 *ACESSO NEGADO*\n\nApenas administradores do grupo podem usar este comando.', msg);
    return;
  }
  const alvo = await obterAlvo(sock, grupo, msg);
  if (!alvo) {
    await enviar(sock, grupo, '⚠️ Marque o membro ou responda à mensagem dele para usar este comando.', msg);
    return;
  }
  try {
    await sock.groupParticipantsUpdate(grupo, [alvo], acao);
    const textos = {
      remove: '🛫 *MEMBRO REMOVIDO*\n\nO membro foi removido do grupo.',
      promote: '👑 *MEMBRO PROMOVIDO*\n\nO membro agora é administrador.',
      demote: '⬇️ *ADMINISTRADOR REBAIXADO*\n\nO membro deixou de ser administrador.'
    };
    await enviar(sock, grupo, textos[acao] || '✅ Ação concluída.', msg);
  } catch (erro) {
    console.error('❌ Erro administrativo:', erro);
    await enviar(sock, grupo, '❌ Não foi possível executar a ação. Verifique se o bot é administrador e se o membro pode receber esta ação.', msg);
  }
}

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['VERDÃO BOT','Chrome','1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 ESCANEIE O QR CODE:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('\n🟢 VERDÃO BOT ONLINE!\n');
      console.log(`🐷 ${NOME_BOT}`);
      console.log('📱 Número conectado');
      console.log(`👥 Grupo configurado: ${GRUPO_VERDAO}`);
      console.log('📡 API: football-data.org');
      console.log(`⚽ Palmeiras ID: ${PALMEIRAS_ID}\n`);
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log('🔄 Conexão encerrada. Reconectando...');
        setTimeout(iniciarBot, 3000);
      } else {
        console.log('❌ Sessão encerrada. Será necessário conectar novamente.');
      }
    }
  });

  function obterJidParticipante(participante) {
    if (!participante) return '';

    // No Baileys 7, grupos LID podem entregar o ID do participante
    // como @lid. Para a menção do WhatsApp, priorizamos o PN/
    // número @s.whatsapp.net quando ele estiver disponível.
    if (typeof participante === 'string') {
      return participante;
    }

    const candidatos = [
      participante.phoneNumber,
      participante.pn,
      participante.participantPn,
      participante.jid,
      participante.id,
      participante.participantAlt,
      participante.participant,
      participante.lid
    ];

    const pn = candidatos.find(v => typeof v === 'string' && v.endsWith('@s.whatsapp.net'));
    if (pn) return pn;

    return candidatos.find(v => typeof v === 'string' && v.trim()) || '';
  }

  function numeroParaMencao(jid) {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0];
  }

  async function tentarEnviarEventoGrupo(jid, imagem, texto, alvo) {
    try {
      if (imagemDisponivel(imagem)) {
        await enviarComImagem(sock, jid, imagem, texto, null, alvo ? [alvo] : []);
      } else {
        await enviar(sock, jid, texto, null, alvo ? { mentions: [alvo] } : {});
      }
      return true;
    } catch (erro) {
      console.error('❌ Falha ao enviar mensagem de entrada/saída:', erro?.message || erro);
      return false;
    }
  }

  sock.ev.on('group-participants.update', async update => {
    try {
      if (update.id !== GRUPO_VERDAO) return;
      console.log(`👥 Evento do grupo: ${update.action} | participantes: ${(update.participants || []).length}`);

      for (const participante of update.participants || []) {
        const alvo = obterJidParticipante(participante);
        if (!alvo) continue;

        if (update.action === 'add') {
          const texto = `╭━━━〔 💚 𝗣𝗔𝗟𝗠𝗘𝗜𝗥𝗔𝗦 💚 〕━━━╮

🛬 *𝗡𝗢𝗩𝗢 𝗠𝗘𝗠𝗕𝗥𝗢!*

Seja muito bem-vindo(a), @${numeroParaMencao(alvo)}! 🐷

💚 Aqui é o espaço da torcida do *Palmeiras* para acompanhar jogos, resultados, notícias e tudo sobre o Verdão.

📌 *Antes de participar:*
› /menu — Ver os comandos
› /regra — Ler as regras

🤝 Respeite os membros e mantenha o grupo organizado.

🐷💚 *𝗔𝗩𝗔𝗡𝗧𝗜 𝗣𝗔𝗟𝗘𝗦𝗧𝗥𝗔!*

╰━━━━━━━━━━━━━━━━━━━━━━╯`;
          await tentarEnviarEventoGrupo(update.id, IMAGENS.entrada, texto, alvo);
        }

        if (update.action === 'remove') {
          const texto = `╭━━━〔 💚 𝗣𝗔𝗟𝗠𝗘𝗜𝗥𝗔𝗦 💚 〕━━━╮

🛫 *𝗠𝗘𝗠𝗕𝗥𝗢 𝗦𝗔𝗜𝗨!*

👤 @${numeroParaMencao(alvo)} deixou o grupo.

💚 Agradecemos por ter feito parte da nossa comunidade do Palmeiras.

🐷 *𝗔𝗩𝗔𝗡𝗧𝗜 𝗣𝗔𝗟𝗘𝗦𝗧𝗥𝗔!*

╰━━━━━━━━━━━━━━━━━━━━━━╯`;
          await tentarEnviarEventoGrupo(update.id, IMAGENS.saida, texto, alvo);
        }
      }
    } catch (erro) {
      console.error('❌ Erro no evento de entrada/saída:', erro?.message || erro);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages || []) {
      try {
        if (!msg?.message) continue;
        const grupo = msg.key?.remoteJid;
        if (grupo !== GRUPO_VERDAO) continue;
        const texto = extrairTexto(msg);
        if (!texto) continue;
        const comando = texto.toLowerCase().trim().split(/\s+/)[0];

        // MENUS
        if (comando === '/menu' || comando === '/comandos') {
          if (imagemDisponivel(IMAGENS.menu)) await enviarComImagem(sock, grupo, IMAGENS.menu, MENU_PRINCIPAL, msg);
          else await enviar(sock, grupo, MENU_PRINCIPAL, msg);
          continue;
        }
        const menus = {
          '/menujogos': MENU_JOGOS, '/jogos': MENU_JOGOS,
          '/menucompeticoes': MENU_COMPETICOES, '/competicoes': MENU_COMPETICOES,
          '/menuelenco': MENU_ELENCO, '/menuel': MENU_ELENCO,
          '/menunoticias': MENU_NOTICIAS, '/noticiasmenu': MENU_NOTICIAS,
          '/menuclube': MENU_CLUBE, '/clube': MENU_CLUBE,
          '/menualertas': MENU_ALERTAS, '/alertasmenu': MENU_ALERTAS
        };
        if (menus[comando]) { await enviar(sock, grupo, menus[comando], msg); continue; }

        // REGRAS
        if (comando === '/regra' || comando === '/regras') {
          if (imagemDisponivel(IMAGENS.regras)) {
            await enviarComImagem(sock, grupo, IMAGENS.regras, REGRAS_GRUPO, msg);
          } else {
            await enviar(sock, grupo, REGRAS_GRUPO, msg);
          }
          continue;
        }

        // PAINEL ADMINISTRATIVO
        if (comando === '/adm' || comando === '/admin' || comando === '/painel' || comando === '/menuadm') {
          const remetente = msg?.key?.participant || msg?.participant || sock.user?.id || '';
          if (!(await ehAdmin(sock, grupo, remetente))) {
            await enviar(sock, grupo, '🔒 *PAINEL RESTRITO*\n\nEste painel está disponível somente para administradores do grupo.', msg);
          } else {
            await enviar(sock, grupo, MENU_ADMIN, msg);
          }
          continue;
        }

        // COMANDOS DE FUTEBOL COM API
        const comandosAPI = {
          '/pj': obterProximoJogo, '/proximojogo': obterProximoJogo,
          '/cal': obterCalendario, '/calendario': obterCalendario,
          '/res': obterResultados, '/resultados': obterResultados,
          '/class': obterClassificacao, '/classificacao': obterClassificacao,
          '/bra': obterBrasileirao, '/brasileirao': obterBrasileirao,
          '/lib': obterLibertadores, '/libertadores': obterLibertadores,
          '/el': obterElenco, '/elenco': obterElenco,
          '/jog': obterJogadores, '/jogadores': obterJogadores,
          '/art': obterArtilheiros, '/artilheiros': obterArtilheiros,
          '/stats': obterEstatisticas, '/estatisticas': obterEstatisticas,
          '/pal': obterPalmeiras, '/palmeiras': obterPalmeiras,
          '/esc': obterEscalacao, '/escalacao': obterEscalacao
        };
        if (comandosAPI[comando]) {
          let resposta;
          try { resposta = await comandosAPI[comando](); }
          catch (erro) { resposta = mensagemErroAPI(erro); }
          await enviar(sock, grupo, resposta, msg);
          continue;
        }

        // FUNÇÕES AINDA NÃO INTEGRADAS
        const desenvolvimento = {
          '/cdb': 'O comando /cdb — Copa do Brasil', '/copadobrasil': 'O comando /cdb — Copa do Brasil',
          '/mun': 'O comando /mun — Mundial', '/mundial': 'O comando /mun — Mundial',
          '/not': 'O comando /not — Notícias', '/noticias': 'O comando /not — Notícias',
          '/merc': 'O comando /merc — Mercado', '/mercado': 'O comando /merc — Mercado',
          '/cont': 'O comando /cont — Contratações', '/contratacoes': 'O comando /cont — Contratações',
          '/sai': 'O comando /sai — Saídas', '/saidas': 'O comando /sai — Saídas',
          '/ali': 'O comando /ali — Allianz Parque', '/allianz': 'O comando /ali — Allianz Parque',
          '/hist': 'O comando /hist — História', '/historia': 'O comando /hist — História',
          '/tit': 'O comando /tit — Títulos', '/titulos': 'O comando /tit — Títulos',
          '/alertas': 'O comando /alertas — Central de alertas',
          '/configalertas': 'O comando /configalertas — Configurar alertas'
        };
        if (desenvolvimento[comando]) {
          await enviar(sock, grupo, MENSAGEM_DESENVOLVIMENTO(desenvolvimento[comando]), msg); continue;
        }

        // ADMINISTRAÇÃO
        if (comando === '/ban' || comando === '/kick') {
          await executarAdmin(sock, grupo, msg, 'remove'); continue;
        }
        if (comando === '/promover') {
          await executarAdmin(sock, grupo, msg, 'promote'); continue;
        }
        if (comando === '/rebaixar') {
          await executarAdmin(sock, grupo, msg, 'demote'); continue;
        }

        if (comando === '/fechar' || comando === '/abrir') {
          const remetente = msg?.key?.participant || msg?.participant || sock.user?.id || '';
          if (!(await ehAdmin(sock, grupo, remetente))) {
            await enviar(sock, grupo, '🔒 *ACESSO NEGADO*\n\nApenas administradores podem alterar o modo do grupo.', msg);
            continue;
          }
          try {
            const modo = comando === '/fechar' ? 'announcement' : 'not_announcement';
            await sock.groupSettingUpdate(grupo, modo);
            await enviar(sock, grupo, comando === '/fechar'
              ? '🔒 *GRUPO FECHADO*\n\nAgora somente administradores podem enviar mensagens.'
              : '🔓 *GRUPO ABERTO*\n\nTodos os membros podem enviar mensagens novamente.', msg);
          } catch (erro) {
            console.error('❌ Erro ao alterar configuração do grupo:', erro);
            await enviar(sock, grupo, '❌ Não consegui alterar a configuração. Verifique se o bot é administrador.', msg);
          }
          continue;
        }

        if (comando === '/linkgrupo') {
          const remetente = msg?.key?.participant || msg?.participant || sock.user?.id || '';
          if (!(await ehAdmin(sock, grupo, remetente))) {
            await enviar(sock, grupo, '🔒 *ACESSO NEGADO*\n\nApenas administradores podem gerar o link do grupo.', msg);
            continue;
          }
          try {
            const codigo = await sock.groupInviteCode(grupo);
            await enviar(sock, grupo, `🔗 *LINK DO GRUPO*\n\nhttps://chat.whatsapp.com/${codigo}`, msg);
          } catch (erro) {
            console.error('❌ Erro ao gerar link:', erro);
            await enviar(sock, grupo, '❌ Não consegui gerar o link do grupo.', msg);
          }
          continue;
        }

        if (comando === '/apagar') {
          const remetente = msg?.key?.participant || msg?.participant || sock.user?.id || '';
          if (!(await ehAdmin(sock, grupo, remetente))) {
            await enviar(sock, grupo, '🔒 *ACESSO NEGADO*\n\nApenas administradores podem apagar mensagens.', msg);
            continue;
          }
          const contexto = msg?.message?.extendedTextMessage?.contextInfo;
          const quotedStanzaId = contexto?.stanzaId;
          const quotedParticipant = contexto?.participant;
          if (!quotedStanzaId || !quotedParticipant) {
            await enviar(sock, grupo, '⚠️ Responda à mensagem que deseja apagar e envie */apagar*.', msg);
            continue;
          }
          try {
            await sock.sendMessage(grupo, {
              delete: { remoteJid: grupo, fromMe: false, id: quotedStanzaId, participant: quotedParticipant }
            });
            await enviar(sock, grupo, '🗑️ Mensagem apagada pela administração.', msg);
          } catch (erro) {
            console.error('❌ Erro ao apagar mensagem:', erro);
            await enviar(sock, grupo, '❌ Não consegui apagar essa mensagem.', msg);
          }
          continue;
        }

        // SISTEMA
        if (comando === '/ping') {
          await enviar(sock, grupo, `╭━━━〔 🏓 𝗣𝗢𝗡𝗚 〕━━━╮\n\n🐷 ${NOME_BOT}\n🟢 Sistema online\n📡 API conectada\n⚡ Funcionando normalmente\n\n╰━━━━━━━━━━━━━━━━━━━━╯`, msg); continue;
        }
        if (comando === '/status') {
          await enviar(sock, grupo, `╭━━━〔 📊 𝗦𝗧𝗔𝗧𝗨𝗦 〕━━━╮\n\n🐷 Bot: *${NOME_BOT}*\n🟢 Status: *ONLINE*\n⚽ Projeto: *PALMEIRAS*\n📡 Dados: *football-data.org*\n🔗 API: *CONECTADA*\n\n💚 *AVANTI PALESTRA!*\n╰━━━━━━━━━━━━━━━━━━━━╯`, msg); continue;
        }
        if (comando === '/idgrupo') {
          await enviar(sock, grupo, `🆔 *ID DO GRUPO*\n\n${grupo}`, msg); continue;
        }
        if (comando === '/dono') {
          await enviar(sock, grupo, `👑 *DONO DO VERDÃO BOT*\n\n👤 ${DONO}`, msg); continue;
        }
      } catch (erro) {
        console.error('❌ Erro ao processar mensagem:', erro);
      }
    }
  });
}

iniciarBot().catch(erro => {
  console.error('❌ ERRO AO INICIAR O BOT:');
  console.error(erro);
});
