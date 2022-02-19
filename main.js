// node v14
const {Client, Intents} = require('discord.js');
const io = require('socket.io-client');
const fetch = require('node-fetch');
const config = require('./config.json');

// TODO: use embeds https://discordjs.guide/popular-topics/embeds.html#embed-preview

const client = new Client({intents: [Intents.FLAGS.GUILDS]});

const getExplorerData = async (url, postData) => {
  const opts = {};

  if (postData) {
    opts.body = JSON.stringify(postData);
    opts.headers = {'Content-Type': 'application/json'};
    opts.method = 'POST';
  }

  const response = await fetch(url, opts);
  const isJson = response.headers.get('Content-Type').includes('application/json');

  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(body);
  }

  return body;
};

const timeout = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, 1000);
  });
};

const formatDataUrl = (url) => {
  const ipfsGatewayUrl = 'infura-ipfs.io';

  if (url.indexOf('ipfs://') > -1) {
    url = url.replace('ipfs://', `https://${ipfsGatewayUrl}/ipfs/`);
  } else if (url.indexOf('https://ipfs.io') > -1) {
    url = url.replace('https://ipfs.io', `https://${ipfsGatewayUrl}`);
  }

  return url;
};

const formatArbitraryData = (data) => {
  let _data = data;

  try {
    _data = JSON.stringify(JSON.parse(data), null, 2);
  } catch(e) {}

  return _data;
};

const formatRoyalty = (royalty) => {
  return `${royalty * 100 / 1000}%`;
};

const log = () => {
  return process.argv.indexOf('debug') > -1 ? console.log : null;
};

const sendTestMessage = (channel) => {
  const decodeTokenTx = {
    decoded: {
      tokenid: '8bd98f56979bf1015e81535268e411c6f4a49dd59d39e2cb562908a7cc72c816',
      create: {
        supply: 1,
        name: 'Test token1',
        description: 'Some description',
        nftData: {
          url: 'https://thumbs.dreamstime.com/b/cartoon-silly-robot-looking-55524172.jpg',
          id: 1,
          royalty: 100,
          arbitrary:"{\"head\":1,\"left arm\":1,\"right arm\":1,\"hat\":0,\"nose\":0,\"category\":1,\"rarity\":1}"
        },
      },
    },
  };
  channel.send(
    '**New ' + (decodeTokenTx.decoded.create.supply === 1 ? 'NFT' : 'Fixed Supply') + ' token created!**\n\n' +
    '**Name:** ' + decodeTokenTx.decoded.create.name + '\n' +
    (decodeTokenTx.decoded.create.description ? '**Description:** ' + decodeTokenTx.decoded.create.description + '\n' : '') +
    (decodeTokenTx.decoded.create.supply > 1 ? '**Supply:** ' + decodeTokenTx.decoded.create.supply + '\n' : '') +
    (decodeTokenTx.decoded.create.nftData && decodeTokenTx.decoded.create.nftData.id ? '**ID**: ' + decodeTokenTx.decoded.create.nftData.id + '\n' : '') +
    (decodeTokenTx.decoded.create.nftData && decodeTokenTx.decoded.create.nftData.royalty ? '**Royalty**: ' + formatRoyalty(decodeTokenTx.decoded.create.nftData.royalty) + '\n' : '') +
    (decodeTokenTx.decoded.create.nftData && decodeTokenTx.decoded.create.nftData.arbitrary ? '**Arbitrary data**: ```' + formatArbitraryData(decodeTokenTx.decoded.create.nftData.arbitrary) + '```\n' : '') +
    (decodeTokenTx.decoded.create.nftData && decodeTokenTx.decoded.create.nftData.url ? '**URL**: ' + formatDataUrl(decodeTokenTx.decoded.create.nftData.url) + '\n' : '') +
    `**Explorer URL**: <${config.EXPLORER_TXID_URL.replace('#tokenid#', decodeTokenTx.decoded.tokenid)}>\n`
  );
};

(async () => {
  await client.login(config.BOT_TOKEN);
  // i know no better way to wait for discord channels cache availability :(
  await timeout();
  const channel = client.channels.cache.get(config.CHANNEL_ID);
  //sendTestMessage(channel);

  const eventToListenTo = 'tx';
  const room = 'inv';

  const socket = io.connect(config.EXPLORER_WS_HOST_URL, {
    'path': config.EXPLORER_WS_SOCKET_URL,
    'reconnect': true,
    'reconnection delay': 500,
  });
  socket.on('connect', () => {
    socket.emit('subscribe', room);
  });
  socket.on(eventToListenTo, async (data) => {
    log(`new transaction received: ${data.txid}`);

    const rawtx = await getExplorerData(`${config.EXPLORER_WS_HOST_URL}${config.EXPLORER_API_URL}/rawtx/${data.txid}`);
    log('rawtx', rawtx);
  
    if (rawtx && rawtx.rawtx) {
      const decodeTokenTx = await getExplorerData(`${config.EXPLORER_WS_HOST_URL}${config.EXPLORER_API_URL}/tokens/decode`, rawtx);
      log('decodeTokenTx', JSON.stringify(decodeTokenTx, null, 2));
  
      if (decodeTokenTx &&
          decodeTokenTx.decoded &&
          decodeTokenTx.decoded.create) {
        log('new token created');
        
        channel.send(
          '**New ' + (decodeTokenTx.decoded.create.supply === 1 ? 'NFT' : 'Fixed Supply') + ' token created!**\n\n' +
          '**Name:** ' + decodeTokenTx.decoded.create.name + '\n' +
          (decodeTokenTx.decoded.create.description ? '**Description:** ' + decodeTokenTx.decoded.create.description + '\n' : '') +
          (decodeTokenTx.decoded.create.supply > 1 ? '**Supply:** ' + decodeTokenTx.decoded.create.supply + '\n' : '') +
          (decodeTokenTx.decoded.create.nftData && decodeTokenTx.decoded.create.nftData.id ? '**ID**: ' + decodeTokenTx.decoded.create.nftData.id + '\n' : '') +
          (decodeTokenTx.decoded.create.nftData && decodeTokenTx.decoded.create.nftData.royalty ? '**Royalty**: ' + formatRoyalty(decodeTokenTx.decoded.create.nftData.royalty) + '\n' : '') +
          (decodeTokenTx.decoded.create.nftData && decodeTokenTx.decoded.create.nftData.arbitrary ? '**Arbitrary data**: ```' + formatArbitraryData(decodeTokenTx.decoded.create.nftData.arbitrary) + '```\n' : '') +
          (decodeTokenTx.decoded.create.nftData && decodeTokenTx.decoded.create.nftData.url ? '**URL**: ' + formatDataUrl(decodeTokenTx.decoded.create.nftData.url) + '\n' : '') +
          `**Explorer URL**: <${config.EXPLORER_TXID_URL.replace('#tokenid#', decodeTokenTx.decoded.tokenid)}>\n`
        );
      }
    }
  });
})();