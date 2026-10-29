const http = require('http');
http.createServer((req, res) => {
  res.write("Bot Online");
  res.end();
}).listen(process.env.PORT || 3000);

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');
const fs = require('fs');

// ==================================================
// CONFIGURAÇÕES
// ==================================================

const GRUPO_VERDAO = '120363413059034119@g.us';
const NOME_BOT = '🐷 VERDÃO BOT';
const DONO = 'VERDÃO';

const PALMEIRAS_ID = 1769;
const COMPETICAO_BRASILEIRAO = 'BSA';
const COMPETICAO_LIBERTADORES = 'CLI';
const TEMPORADA = 2026;

const CONFIG_PATH = './config.json';

// ==================================================
// API FOOTBALL-DATA.ORG
// ==================================================

let API_TOKEN = '';

try {
  const config = JSON.parse(
    fs.readFileSync(CONFIG_PATH, 'utf8')
  );

  // Mantém compatibilidade com o nome que você já usa
  API_TOKEN =
    config.FOOTBALL_DATA_TOKEN ||
    config.API_FUTEBOL_KEY ||
    '';

} catch (erro) {
  console.error(
    '⚠️ Não foi possível ler o config.json'
  );
}

// ==================================================
// CACHE
// ==================================================

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
  cache.set(chave, {
    dados,
    expira: Date.now() + segundos * 1000
  });
}

// ==================================================
// REQUISIÇÃO À API
// ==================================================

async function apiFootballData(endpoint, cacheKey, cacheSeconds = 60) {

  const salvo = pegarCache(cacheKey);

  if (salvo) {
    return salvo;
  }

  if (!API_TOKEN) {
    throw new Error(
      'Token da API não encontrado no config.json'
    );
  }

  const resposta = await fetch(
    `https://api.football-data.org/v4${endpoint}`,
    {
      headers: {
        'X-Auth-Token': API_TOKEN
      }
    }
  );

  const texto = await resposta.text();

  let dados;

  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(
      `Resposta inválida da API. HTTP ${resposta.status}`
    );
  }

  if (!resposta.ok) {
    throw new Error(
      dados?.message ||
      `Erro da API. HTTP ${resposta.status}`
    );
  }

  salvarCache(
    cacheKey,
    dados,
    cacheSeconds
  );

  return dados;
}

// ==================================================
// FUNÇÕES UTILITÁRIAS
// ==================================================

function extrairTexto(msg) {

  if (!msg.message) return '';

  return (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    ''
  ).trim();
}

// Envia mensagem citando quem chamou o comando
async function enviar(
  sock,
  jid,
  texto,
  msg = null,
  opcoes = {}
) {

  const conteudo = {
    text: texto,
    ...opcoes
  };

  if (msg?.key) {

    await sock.sendMessage(
      jid,
      conteudo,
      {
        quoted: msg
      }
    );

  } else {

    await sock.sendMessage(
      jid,
      conteudo
    );

  }
}

// ==================================================
// DATA / HORA
// ==================================================

function formatarData(utcDate) {

  if (!utcDate) return 'Data não informada';

  const data = new Date(utcDate);

  return data.toLocaleString(
    'pt-BR',
    {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );
}

function formatarDia(utcDate) {

  if (!utcDate) return '--/--';

  const data = new Date(utcDate);

  return data.toLocaleDateString(
    'pt-BR',
    {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit'
    }
  );
}

// ==================================================
// NOMES DE POSIÇÕES
// ==================================================

function traduzirPosicao(posicao) {

  const mapa = {
    'Goalkeeper': 'Goleiro',
    'Defence': 'Defesa',
    'Midfield': 'Meio-campo',
    'Offence': 'Ataque',
    'Centre-Forward': 'Centroavante',
    'Attacking Midfield': 'Meia-atacante',
    'Left Winger': 'Ponta esquerda',
    'Right Winger': 'Ponta direita',
    'Defensive Midfield': 'Volante',
    'Central Midfield': 'Meia',
    'Left-Back': 'Lateral esquerdo',
    'Right-Back': 'Lateral direito',
    'Centre-Back': 'Zagueiro'
  };

  return mapa[posicao] || posicao || 'Posição não informada';
}

// ==================================================
// TIMES
// ==================================================

function nomeTime(time) {
  return (
    time?.shortName ||
    time?.name ||
    'Time desconhecido'
  );
}

// ==================================================
// MENU PRINCIPAL
// ==================================================

const MENU_PRINCIPAL = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃   🐷 *VERDÃO BOT*
┃   *CENTRAL PALMEIRAS*
╰━━━━━━━━━━━━━━━━━━━━╯

⚽ *JOGOS*
› /pj → Próximo jogo
› /cal → Calendário
› /res → Resultados
› /esc → Escalação
› /class → Classificação

🏆 *COMPETIÇÕES*
› /bra → Brasileirão
› /lib → Libertadores
› /cdb → Copa do Brasil
› /mun → Mundial

👥 *ELENCO*
› /el → Elenco
› /jog → Jogadores
› /art → Artilheiros
› /stats → Estatísticas

📰 *NOTÍCIAS*
› /not → Notícias
› /merc → Mercado
› /cont → Contratações
› /sai → Saídas

🏟️ *CLUBE*
› /ali → Allianz Parque
› /hist → História
› /tit → Títulos
› /palmeiras → Sobre o Palmeiras

🔔 *ALERTAS*
› /alertas → Central de alertas
› /configalertas → Configurar alertas

━━━━━━━━━━━━━━━━━━━━
💚 *AVANTI PALESTRA!*
`;

// ==================================================
// MENUS SECUNDÁRIOS
// ==================================================

const MENU_JOGOS = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ ⚽ *JOGOS*
╰━━━━━━━━━━━━━━━━━━━━╯

› /pj
  Próximo jogo

› /cal
  Calendário

› /res
  Resultados

› /esc
  Escalação

› /class
  Classificação
`;

const MENU_COMPETICOES = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏆 *COMPETIÇÕES*
╰━━━━━━━━━━━━━━━━━━━━╯

› /bra
  Brasileirão

› /lib
  Libertadores

› /cdb
  Copa do Brasil

› /mun
  Mundial
`;

const MENU_ELENCO = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👥 *ELENCO*
╰━━━━━━━━━━━━━━━━━━━━╯

› /el
  Elenco

› /jog
  Jogadores

› /art
  Artilheiros

› /stats
  Estatísticas
`;

const MENU_NOTICIAS = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📰 *NOTÍCIAS*
╰━━━━━━━━━━━━━━━━━━━━╯

› /not
  Notícias

› /merc
  Mercado

› /cont
  Contratações

› /sai
  Saídas
`;

const MENU_CLUBE = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏟️ *CLUBE*
╰━━━━━━━━━━━━━━━━━━━━╯

› /ali
  Allianz Parque

› /hist
  História

› /tit
  Títulos

› /palmeiras
  Sobre o Palmeiras
`;

const MENU_ALERTAS = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🔔 *ALERTAS*
╰━━━━━━━━━━━━━━━━━━━━╯

› /alertas
  Central de alertas

› /configalertas
  Configurar alertas
`;

// ==================================================
// /PROXIMOJOGO
// ==================================================

async function obterProximoJogo() {

  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}/matches?season=${TEMPORADA}&status=SCHEDULED&limit=10`,
    'proximo-jogo',
    120
  );

  const jogos = dados.matches || [];

  if (!jogos.length) {
    return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ ⚽ *PRÓXIMO JOGO*
╰━━━━━━━━━━━━━━━━━━━━╯

📅 Nenhum próximo jogo encontrado.

💚 *VERDÃO BOT*
`;
  }

  const jogo = jogos[0];

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

// ==================================================
// /CALENDARIO
// ==================================================

async function obterCalendario() {

  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}/matches?season=${TEMPORADA}&limit=20`,
    'calendario-palmeiras',
    180
  );

  const jogos = dados.matches || [];

  const proximos = jogos
    .filter(j => j.status === 'SCHEDULED')
    .slice(0, 10);

  if (!proximos.length) {
    return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📅 *CALENDÁRIO*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum próximo jogo encontrado.
`;
  }

  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📅 *CALENDÁRIO*
╰━━━━━━━━━━━━━━━━━━━━╯
`;

  proximos.forEach((jogo, index) => {

    texto += `

*${index + 1}.* ${formatarDia(jogo.utcDate)}
🏆 ${jogo.competition?.name || 'Competição'}
⚽ ${nomeTime(jogo.homeTeam)} x ${nomeTime(jogo.awayTeam)}`;

  });

  texto += `

━━━━━━━━━━━━━━━━━━━━
🐷 *VERDÃO BOT*`;

  return texto;
}

// ==================================================
// /RESULTADOS
// ==================================================

async function obterResultados() {

  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}/matches?season=${TEMPORADA}&status=FINISHED&limit=10`,
    'resultados-palmeiras',
    180
  );

  const jogos = dados.matches || [];

  if (!jogos.length) {
    return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📊 *RESULTADOS*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum resultado encontrado.
`;
  }

  const recentes = jogos
    .slice(-10)
    .reverse();

  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📊 *ÚLTIMOS RESULTADOS*
╰━━━━━━━━━━━━━━━━━━━━╯
`;

  recentes.forEach((jogo, index) => {

    const casa = jogo.score?.fullTime?.home;
    const fora = jogo.score?.fullTime?.away;

    let placar = 'x';

    if (
      casa !== null &&
      casa !== undefined &&
      fora !== null &&
      fora !== undefined
    ) {
      placar = `${casa} x ${fora}`;
    }

    texto += `

*${index + 1}.* ${formatarDia(jogo.utcDate)}
🏆 ${jogo.competition?.name || 'Competição'}
⚽ ${nomeTime(jogo.homeTeam)} *${placar}* ${nomeTime(jogo.awayTeam)}`;

  });

  texto += `

━━━━━━━━━━━━━━━━━━━━
🐷 *PALMEIRAS*`;

  return texto;
}

// ==================================================
// /CLASSIFICACAO
// ==================================================

async function obterClassificacao() {

  const dados = await apiFootballData(
    `/competitions/${COMPETICAO_BRASILEIRAO}/standings?season=${TEMPORADA}`,
    'classificacao-brasileirao',
    180
  );

  const tabela =
    dados.standings?.find(
      s => s.type === 'TOTAL'
    ) ||
    dados.standings?.[0];

  const times = tabela?.table || [];

  if (!times.length) {
    return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏆 *CLASSIFICAÇÃO*
╰━━━━━━━━━━━━━━━━━━━━╯

Não foi possível carregar a tabela.
`;
  }

  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🇧🇷 *BRASILEIRÃO 2026*
╰━━━━━━━━━━━━━━━━━━━━╯

`;

  times.forEach(time => {

    const pos = String(time.position).padStart(2, '0');

    texto +=
      `${pos}º ${time.team.shortName || time.team.name} — ${time.points} pts\n`;

  });

  texto += `
━━━━━━━━━━━━━━━━━━━━
🐷 *PALMEIRAS: ${times.find(t => t.team.id === PALMEIRAS_ID)?.position || '-'}º*
`;

  return texto;
}

// ==================================================
// /BRASILEIRAO
// ==================================================

async function obterBrasileirao() {

  const dados = await apiFootballData(
    `/competitions/${COMPETICAO_BRASILEIRAO}/standings?season=${TEMPORADA}`,
    'brasileirao-info',
    180
  );

  const tabela =
    dados.standings?.find(
      s => s.type === 'TOTAL'
    ) ||
    dados.standings?.[0];

  const palmeiras =
    tabela?.table?.find(
      t => t.team.id === PALMEIRAS_ID
    );

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
💚 *AVANTI PALESTRA!*
`;
}

// ==================================================
// /LIBERTADORES
// ==================================================

async function obterLibertadores() {

  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}/matches?season=${TEMPORADA}&competitions=${COMPETICAO_LIBERTADORES}&limit=20`,
    'libertadores-palmeiras',
    180
  );

  const jogos = dados.matches || [];

  if (!jogos.length) {
    return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🌎 *LIBERTADORES*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum jogo encontrado.
`;
  }

  const proximos = jogos
    .filter(j => j.status === 'SCHEDULED');

  const resultados = jogos
    .filter(j => j.status === 'FINISHED')
    .slice(-5)
    .reverse();

  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🌎 *LIBERTADORES 2026*
╰━━━━━━━━━━━━━━━━━━━━╯
`;

  if (proximos.length) {

    texto += `

⚽ *PRÓXIMOS JOGOS*
`;

    proximos.slice(0, 5).forEach(jogo => {

      texto += `
📅 ${formatarDia(jogo.utcDate)}
🏆 ${jogo.stage || 'Fase'}
⚽ ${nomeTime(jogo.homeTeam)} x ${nomeTime(jogo.awayTeam)}`;

    });
  }

  if (resultados.length) {

    texto += `

📊 *ÚLTIMOS RESULTADOS*
`;

    resultados.forEach(jogo => {

      const casa = jogo.score?.fullTime?.home;
      const fora = jogo.score?.fullTime?.away;

      texto += `
📅 ${formatarDia(jogo.utcDate)}
⚽ ${nomeTime(jogo.homeTeam)} *${casa} x ${fora}* ${nomeTime(jogo.awayTeam)}`;

      if (jogo.score?.penalties) {
        texto += `\n🥅 Pênaltis: ${jogo.score.penalties.home} x ${jogo.score.penalties.away}`;
      }

    });
  }

  texto += `

━━━━━━━━━━━━━━━━━━━━
🐷 *PALMEIRAS*
💚 *AVANTI PALESTRA!*`;

  return texto;
}

// ==================================================
// /ELENCO
// ==================================================

async function obterElenco() {

  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}`,
    'elenco-palmeiras',
    3600
  );

  const jogadores = dados.squad || [];

  if (!jogadores.length) {
    return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👥 *ELENCO*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum jogador encontrado.
`;
  }

  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👥 *ELENCO PALMEIRAS*
╰━━━━━━━━━━━━━━━━━━━━╯

`;

  const grupos = {
    'Goalkeeper': [],
    'Defence': [],
    'Midfield': [],
    'Offence': [],
    'Centre-Forward': [],
    'Attacking Midfield': [],
    'Left Winger': [],
    'Right Winger': []
  };

  jogadores.forEach(jogador => {

    const pos = jogador.position || 'Offence';

    if (!grupos[pos]) {
      grupos[pos] = [];
    }

    grupos[pos].push(jogador);
  });

  Object.keys(grupos).forEach(posicao => {

    if (!grupos[posicao].length) return;

    texto += `*${traduzirPosicao(posicao).toUpperCase()}*\n`;

    grupos[posicao].forEach(jogador => {
      texto += `• ${jogador.name}\n`;
    });

    texto += '\n';
  });

  texto += `
━━━━━━━━━━━━━━━━━━━━
🐷 *${jogadores.length} jogadores cadastrados*
`;

  return texto;
}

// ==================================================
// /JOGADORES
// ==================================================

async function obterJogadores() {

  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}`,
    'jogadores-palmeiras',
    3600
  );

  const jogadores = dados.squad || [];

  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👤 *JOGADORES*
╰━━━━━━━━━━━━━━━━━━━━╯

`;

  jogadores.forEach((jogador, index) => {

    texto +=
      `*${index + 1}.* ${jogador.name}\n` +
      `   📌 ${traduzirPosicao(jogador.position)}\n`;

  });

  texto += `
━━━━━━━━━━━━━━━━━━━━
🐷 *VERDÃO BOT*
`;

  return texto;
}

// ==================================================
// /ARTILHEIROS
// ==================================================

async function obterArtilheiros() {

  const dados = await apiFootballData(
    `/competitions/${COMPETICAO_BRASILEIRAO}/scorers?season=${TEMPORADA}&limit=10`,
    'artilheiros-brasileirao',
    180
  );

  const artilheiros = dados.scorers || [];

  if (!artilheiros.length) {
    return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🥅 *ARTILHEIROS*
╰━━━━━━━━━━━━━━━━━━━━╯

Nenhum dado encontrado.
`;
  }

  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🥅 *ARTILHEIROS*
┃ 🇧🇷 BRASILEIRÃO 2026
╰━━━━━━━━━━━━━━━━━━━━╯

`;

  artilheiros.forEach((jogador, index) => {

    texto +=
      `*${index + 1}º* ${jogador.player.name}\n` +
      `   🏟️ ${jogador.team.shortName || jogador.team.name}\n` +
      `   ⚽ ${jogador.goals || 0} gols`;

    if (
      jogador.assists !== null &&
      jogador.assists !== undefined
    ) {
      texto += ` | 🎯 ${jogador.assists} assist.`;
    }

    texto += '\n\n';
  });

  texto += `
━━━━━━━━━━━━━━━━━━━━
🐷 *VERDÃO BOT*
`;

  return texto;
}

// ==================================================
// /STATS
// ==================================================

async function obterEstatisticas() {

  const dados = await apiFootballData(
    `/competitions/${COMPETICAO_BRASILEIRAO}/scorers?season=${TEMPORADA}&limit=100`,
    'stats-brasileirao',
    180
  );

  const palmeirenses =
    (dados.scorers || [])
      .filter(
        jogador =>
          jogador.team?.id === PALMEIRAS_ID
      );

  if (!palmeirenses.length) {
    return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📈 *ESTATÍSTICAS*
╰━━━━━━━━━━━━━━━━━━━━╯

Ainda não encontrei estatísticas
individuais do Palmeiras no retorno
da API.
`;
  }

  let texto = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📈 *PALMEIRAS*
┃ ESTATÍSTICAS 2026
╰━━━━━━━━━━━━━━━━━━━━╯

`;

  palmeirenses
    .sort(
      (a, b) =>
        (b.goals || 0) -
        (a.goals || 0)
    )
    .slice(0, 10)
    .forEach((jogador, index) => {

      texto +=
        `*${index + 1}.* ${jogador.player.name}\n` +
        `⚽ Gols: ${jogador.goals || 0}\n` +
        `🎯 Assistências: ${jogador.assists || 0}\n` +
        `🎮 Jogos: ${jogador.playedMatches || 0}\n\n`;

    });

  texto += `
━━━━━━━━━━━━━━━━━━━━
💚 *AVANTI PALESTRA!*
`;

  return texto;
}

// ==================================================
// /PALMEIRAS
// ==================================================

async function obterPalmeiras() {

  const dados = await apiFootballData(
    `/teams/${PALMEIRAS_ID}`,
    'dados-palmeiras',
    3600
  );

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
${(dados.runningCompetitions || [])
  .map(c => `• ${c.name}`)
  .join('\n')}

━━━━━━━━━━━━━━━━━━━━
💚 *AVANTI PALESTRA!*
`;
}

// ==================================================
// /ESCALACAO
// ==================================================

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
🐷 *VERDÃO BOT*
`;
}

// ==================================================
// INFORMAÇÕES FIXAS
// ==================================================

const INFORMACOES_FIXAS = {

  allianz: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏟️ *ALLIANZ PARQUE*
╰━━━━━━━━━━━━━━━━━━━━╯

🏟️ Casa do Palmeiras

📍 São Paulo - SP

🐷 *PALMEIRAS*

💚 *AVANTI PALESTRA!*
`,

  historia: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📖 *HISTÓRIA*
╰━━━━━━━━━━━━━━━━━━━━╯

💚 O Palmeiras foi fundado em
1914.

🏆 O clube construiu uma longa
história no futebol brasileiro e
sul-americano.

📚 Uma seção histórica mais
completa poderá ser adicionada
ao bot posteriormente.

💚 *AVANTI PALESTRA!*
`,

  titulos: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🏆 *TÍTULOS*
╰━━━━━━━━━━━━━━━━━━━━╯

🏆 A seção de títulos será
organizada por competição em uma
próxima atualização.

📚 Não serão exibidos números
inventados pelo bot.

💚 *AVANTI PALESTRA!*
`,

  noticias: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📰 *NOTÍCIAS*
╰━━━━━━━━━━━━━━━━━━━━╯

📡 A API atual do VERDÃO BOT é
voltada principalmente para
dados de partidas, competições,
elenco e estatísticas.

📰 Notícias serão adicionadas
quando integrarmos uma fonte
específica para notícias.

🐷 *VERDÃO BOT*
`,

  mercado: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🔄 *MERCADO*
╰━━━━━━━━━━━━━━━━━━━━╯

📡 O sistema atual ainda não
possui uma fonte de mercado da
bola.

🔧 Essa função será integrada
posteriormente.
`,

  contratacoes: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🟢 *CONTRATAÇÕES*
╰━━━━━━━━━━━━━━━━━━━━╯

📡 Ainda não há uma fonte de
transferências conectada.

⚠️ O bot não vai inventar
contratações.
`,

  saidas: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🔴 *SAÍDAS*
╰━━━━━━━━━━━━━━━━━━━━╯

📡 Ainda não há uma fonte de
transferências conectada.

⚠️ O bot não vai inventar
informações.
`,

  copadobrasil: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🇧🇷 *COPA DO BRASIL*
╰━━━━━━━━━━━━━━━━━━━━╯

📡 A fonte atual não disponibiliza
os dados necessários da Copa do
Brasil no plano que estamos usando.

🔧 Será integrada outra fonte
posteriormente.
`,

  mundial: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🌎 *MUNDIAL*
╰━━━━━━━━━━━━━━━━━━━━╯

📡 A fonte atual não possui os
dados necessários para esta
competição.

🔧 Função reservada para uma
próxima integração.
`,

  alertas: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🔔 *ALERTAS*
╰━━━━━━━━━━━━━━━━━━━━╯

📢 Central de alertas do
VERDÃO BOT.

Em breve:

• ⚽ Jogos
• 🏁 Resultados
• 📰 Notícias
• 👥 Escalações
`,

  configalertas: `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ ⚙️ *CONFIGURAR ALERTAS*
╰━━━━━━━━━━━━━━━━━━━━╯

🔔 Sistema de configuração de
alertas em desenvolvimento.

Em breve será possível escolher
quais avisos receber.
`
};

// ==================================================
// ERRO API
// ==================================================

function mensagemErroAPI(erro) {

  console.error(
    '❌ ERRO API:',
    erro
  );

  return `
╭━━━━━━━━━━━━━━━━━━━━╮
┃ ⚠️ *ERRO DE DADOS*
╰━━━━━━━━━━━━━━━━━━━━╯

Não consegui carregar os dados
agora.

🔄 Tente novamente em alguns
segundos.

🐷 *VERDÃO BOT*
`;
}

// ==================================================
// CONEXÃO WHATSAPP
// ==================================================

async function iniciarBot() {

  // No Railway, AUTH_DIR deve apontar para o volume persistente (/app/auth).
  // Localmente, o bot continua usando ./auth como padrão.
  const caminhoAuth = process.env.AUTH_DIR || './auth';
  fs.mkdirSync(caminhoAuth, { recursive: true });

  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(caminhoAuth);

  const {
    version
  } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({

    version,

    auth: state,

    printQRInTerminal: false,

    browser: [
      'VERDÃO BOT',
      'Chrome',
      '1.0.0'
    ]
  });

  sock.ev.on(
    'creds.update',
    saveCreds
  );

  // ==================================================
  // CONEXÃO
  // ==================================================

  sock.ev.on(
    'connection.update',
    ({
      connection,
      lastDisconnect,
      qr
    }) => {

      if (qr) {
        console.log('\n🔗 CLIQUE NO LINK ABAIXO PARA ESCANEAR O QR CODE:\n');
        console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}\n`);
      }

      if (connection === 'open') {

        console.log(
          '\n🟢 VERDÃO BOT ONLINE!\n'
        );

        console.log(
          `🐷 ${NOME_BOT}`
        );

        console.log(
          '📱 Número conectado'
        );

        console.log(
          `👥 Grupo configurado: ${GRUPO_VERDAO}`
        );

        console.log(
          '📡 API: football-data.org'
        );

        console.log(
          `⚽ Palmeiras ID: ${PALMEIRAS_ID}\n`
        );
      }

      if (connection === 'close') {

        const statusCode =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;

        if (
          statusCode !==
          DisconnectReason.loggedOut
        ) {

          console.log(
            '🔄 Conexão encerrada. Reconectando...'
          );

          setTimeout(
            iniciarBot,
            3000
          );

        } else {

          console.log(
            '❌ Sessão encerrada. Será necessário conectar novamente.'
          );
        }
      }
    }
  );

  // ==================================================
  // PAREAMENTO POR NÚMERO (RAILWAY)
  // ==================================================

  // Registra primeiro os eventos de conexão e só depois pede o código.
  // Se a sessão já estiver registrada, não solicita outro código.
  if (!state.creds.registered) {
    setTimeout(async () => {
      if (state.creds.registered) {
        console.log('✅ Sessão WhatsApp já registrada.');
        return;
      }

      const numeroPareamento = (process.env.PAIRING_PHONE_NUMBER || '').replace(/\D/g, '');

      if (!numeroPareamento) {
        console.log('⚠️ Configure PAIRING_PHONE_NUMBER nas variáveis da Railway (somente dígitos, com DDI e DDD).');
        return;
      }

      try {
        console.log('📲 Solicitando código de pareamento do WhatsApp...');
        const codigoPareamento = await sock.requestPairingCode(numeroPareamento);
        console.log('🔐 CÓDIGO DE PAREAMENTO DO VERDÃO BOT: ' + codigoPareamento);
        console.log('📱 No WhatsApp, abra Dispositivos conectados > Conectar com número de telefone e digite o código acima.');
      } catch (erroPareamento) {
        console.error('❌ Não foi possível gerar o código de pareamento:', erroPareamento?.message || erroPareamento);
      }
    }, 2000);
  } else {
    console.log('✅ Credenciais encontradas. Tentando restaurar a sessão do WhatsApp...');
  }

  // ==================================================
  // ENTRADA / SAÍDA
  // ==================================================

  sock.ev.on(
    'group-participants.update',
    async (update) => {

      const grupo = update.id;

      if (
        grupo !==
        GRUPO_VERDAO
      ) return;

      for (
        const participante
        of update.participants
      ) {

        if (
          update.action === 'add'
        ) {

          await enviar(
            sock,
            grupo,
            `╭━━━━━━━━━━━━━━━━━━━━╮
┃ 🐷 *BEM-VINDO AO VERDÃO!*
╰━━━━━━━━━━━━━━━━━━━━╯

💚 Seja muito bem-vindo ao grupo!

⚽ Aqui é lugar de falar sobre
o *PALMEIRAS*.

📋 Digite */menu* para conhecer
as funções do VERDÃO BOT.

💚 *AVANTI PALESTRA!*`
          );
        }

        if (
          update.action === 'remove'
        ) {

          await enviar(
            sock,
            grupo,
            `╭━━━━━━━━━━━━━━━━━━━━╮
┃ 👋 *MEMBRO SAIU*
╰━━━━━━━━━━━━━━━━━━━━╯

Um integrante deixou o grupo.

💚 *VERDÃO BOT*`
          );
        }
      }
    }
  );

  // ==================================================
  // MENSAGENS
  // ==================================================

  sock.ev.on(
    'messages.upsert',
    async ({
      messages,
      type
    }) => {

      if (
        type !== 'notify'
      ) return;

      for (
        const msg
        of messages
      ) {

        try {

          if (
            !msg.message
          ) continue;

          const grupo =
            msg.key.remoteJid;

          // SOMENTE O GRUPO DO VERDÃO
          if (
            grupo !==
            GRUPO_VERDAO
          ) continue;

          const texto =
            extrairTexto(msg);

          if (!texto) continue;

          const comando =
            texto
              .toLowerCase()
              .trim()
              .split(/\s+/)[0];

          // ==================================================
          // MENUS
          // ==================================================

          if (
            comando === '/menu' ||
            comando === '/comandos'
          ) {

            await enviar(
              sock,
              grupo,
              MENU_PRINCIPAL,
              msg
            );

            continue;
          }

          if (
            comando === '/menujogos' ||
            comando === '/jogos'
          ) {

            await enviar(
              sock,
              grupo,
              MENU_JOGOS,
              msg
            );

            continue;
          }

          if (
            comando === '/menucompeticoes' ||
            comando === '/competicoes'
          ) {

            await enviar(
              sock,
              grupo,
              MENU_COMPETICOES,
              msg
            );

            continue;
          }

          if (
            comando === '/menuelenco' ||
            comando === '/menuel'
          ) {

            await enviar(
              sock,
              grupo,
              MENU_ELENCO,
              msg
            );

            continue;
          }

          if (
            comando === '/menunoticias' ||
            comando === '/noticiasmenu'
          ) {

            await enviar(
              sock,
              grupo,
              MENU_NOTICIAS,
              msg
            );

            continue;
          }

          if (
            comando === '/menuclube' ||
            comando === '/clube'
          ) {

            await enviar(
              sock,
              grupo,
              MENU_CLUBE,
              msg
            );

            continue;
          }

          if (
            comando === '/menualertas' ||
            comando === '/alertasmenu'
          ) {

            await enviar(
              sock,
              grupo,
              MENU_ALERTAS,
              msg
            );

            continue;
          }

          // ==================================================
          // JOGOS
          // ==================================================

          if (
            comando === '/pj' ||
            comando === '/proximojogo'
          ) {

            let resposta;

            try {

              resposta =
                await obterProximoJogo();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          if (
            comando === '/cal' ||
            comando === '/calendario'
          ) {

            let resposta;

            try {

              resposta =
                await obterCalendario();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          if (
            comando === '/res' ||
            comando === '/resultados'
          ) {

            let resposta;

            try {

              resposta =
                await obterResultados();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          if (
            comando === '/esc' ||
            comando === '/escalacao'
          ) {

            await enviar(
              sock,
              grupo,
              await obterEscalacao(),
              msg
            );

            continue;
          }

          if (
            comando === '/class' ||
            comando === '/classificacao'
          ) {

            let resposta;

            try {

              resposta =
                await obterClassificacao();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          // ==================================================
          // COMPETIÇÕES
          // ==================================================

          if (
            comando === '/bra' ||
            comando === '/brasileirao'
          ) {

            let resposta;

            try {

              resposta =
                await obterBrasileirao();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          if (
            comando === '/lib' ||
            comando === '/libertadores'
          ) {

            let resposta;

            try {

              resposta =
                await obterLibertadores();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          if (
            comando === '/cdb' ||
            comando === '/copadobrasil'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.copadobrasil,
              msg
            );

            continue;
          }

          if (
            comando === '/mun' ||
            comando === '/mundial'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.mundial,
              msg
            );

            continue;
          }

          // ==================================================
          // ELENCO
          // ==================================================

          if (
            comando === '/el' ||
            comando === '/elenco'
          ) {

            let resposta;

            try {

              resposta =
                await obterElenco();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          if (
            comando === '/jog' ||
            comando === '/jogadores'
          ) {

            let resposta;

            try {

              resposta =
                await obterJogadores();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          if (
            comando === '/art' ||
            comando === '/artilheiros'
          ) {

            let resposta;

            try {

              resposta =
                await obterArtilheiros();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          if (
            comando === '/stats' ||
            comando === '/estatisticas'
          ) {

            let resposta;

            try {

              resposta =
                await obterEstatisticas();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          // ==================================================
          // NOTÍCIAS
          // ==================================================

          if (
            comando === '/not' ||
            comando === '/noticias'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.noticias,
              msg
            );

            continue;
          }

          if (
            comando === '/merc' ||
            comando === '/mercado'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.mercado,
              msg
            );

            continue;
          }

          if (
            comando === '/cont' ||
            comando === '/contratacoes'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.contratacoes,
              msg
            );

            continue;
          }

          if (
            comando === '/sai' ||
            comando === '/saidas'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.saidas,
              msg
            );

            continue;
          }

          // ==================================================
          // CLUBE
          // ==================================================

          if (
            comando === '/ali' ||
            comando === '/allianz'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.allianz,
              msg
            );

            continue;
          }

          if (
            comando === '/hist' ||
            comando === '/historia'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.historia,
              msg
            );

            continue;
          }

          if (
            comando === '/tit' ||
            comando === '/titulos'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.titulos,
              msg
            );

            continue;
          }

          if (
            comando === '/palmeiras'
          ) {

            let resposta;

            try {

              resposta =
                await obterPalmeiras();

            } catch (erro) {

              resposta =
                mensagemErroAPI(erro);
            }

            await enviar(
              sock,
              grupo,
              resposta,
              msg
            );

            continue;
          }

          // ==================================================
          // ALERTAS
          // ==================================================

          if (
            comando === '/alertas'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.alertas,
              msg
            );

            continue;
          }

          if (
            comando === '/configalertas'
          ) {

            await enviar(
              sock,
              grupo,
              INFORMACOES_FIXAS.configalertas,
              msg
            );

            continue;
          }

          // ==================================================
          // SISTEMA
          // ==================================================

          if (
            comando === '/ping'
          ) {

            await enviar(
              sock,
              grupo,
              `🏓 *PONG!*

🐷 ${NOME_BOT}
🟢 Sistema online
📡 API conectada
⚡ Funcionando normalmente`,
              msg
            );

            continue;
          }

          if (
            comando === '/status'
          ) {

            await enviar(
              sock,
              grupo,
              `╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📊 *STATUS DO BOT*
╰━━━━━━━━━━━━━━━━━━━━╯

🐷 Bot: *${NOME_BOT}*
🟢 Status: *ONLINE*
⚽ Projeto: *PALMEIRAS*
📡 Dados: *football-data.org*
🔗 API: *CONECTADA*

💚 *AVANTI PALESTRA!*`,
              msg
            );

            continue;
          }

          if (
            comando === '/idgrupo'
          ) {

            await enviar(
              sock,
              grupo,
              `🆔 *ID DO GRUPO*

\`${grupo}\``,
              msg
            );

            continue;
          }

          if (
            comando === '/dono'
          ) {

            await enviar(
              sock,
              grupo,
              `👑 *DONO DO VERDÃO BOT*

👤 ${DONO}`,
              msg
            );

            continue;
          }

        } catch (erro) {

          console.error(
            '❌ Erro ao processar mensagem:',
            erro
          );

        }
      }
    }
  );
}

// ==================================================
// INICIAR
// ==================================================

iniciarBot().catch(
  (erro) => {

    console.error(
      '❌ ERRO AO INICIAR O BOT:'
    );

    console.error(erro);
  }
);
