const axios = require('axios');
const cron = require('node-cron');
const venom = require('venom-bot');

// Configurações da API CoinMarketCap
const apiKey = '356e8d43-bb36-46ea-81ab-2dcce87a785b';

// Números de telefone para notificação via WhatsApp (em formato internacional)
const recipient1 = '556291265035'; // Jorge
const recipient2 = '5562998125181'; // Witor

// Função para formatar o preço com base no valor
function formatPrice(price) {
    return price < 1 ? price.toFixed(8) : price.toFixed(2);
}

// Função para enviar mensagens via WhatsApp usando Venom
async function sendWhatsAppNotification(client, bestOption, potentialMemecoins, mainCoinsData) {
    let messageBody = '🚀 Atualizações do dia:\n\n';

    if (bestOption) {
        messageBody += `🔝 Melhor criptomoeda para compra:\n\n*Nome:* ${bestOption.name}\n*Símbolo:* ${bestOption.symbol}\n*Capitalização de Mercado:* $${bestOption.quote.USD.market_cap.toFixed(2)}\n*Volume 24h:* $${bestOption.quote.USD.volume_24h.toFixed(2)}\n*Variação 7d:* ${bestOption.quote.USD.percent_change_7d.toFixed(2)}%\n*Preço:* $${formatPrice(bestOption.quote.USD.price)}\n\n`;
    } else {
        messageBody += '⚠️ Nenhuma criptomoeda com grande potencial foi encontrada hoje.\n\n';
    }

    if (potentialMemecoins.length > 0) {
        messageBody += '💡 Outras memecoins com potencial:\n\n';
        potentialMemecoins.forEach(coin => {
            messageBody += `*Nome:* ${coin.name}\n*Símbolo:* ${coin.symbol}\n*Capitalização de Mercado:* $${coin.quote.USD.market_cap.toFixed(2)}\n*Volume 24h:* $${coin.quote.USD.volume_24h.toFixed(2)}\n*Variação 7d:* ${coin.quote.USD.percent_change_7d.toFixed(2)}%\n*Preço:* $${formatPrice(coin.quote.USD.price)}\n\n`;
        });
    }

    messageBody += '📊 Desempenho das principais criptomoedas:\n\n';
    mainCoinsData.forEach(coin => {
        messageBody += `*Nome:* ${coin.name}\n*Preço:* $${formatPrice(coin.quote.USD.price)}\n*Variação 24h:* ${coin.quote.USD.percent_change_24h.toFixed(2)}%\n\n`;
    });

    try {
        // Enviar mensagem para ambos os contatos
        await client.sendText(`55${recipient1}@c.us`, messageBody);
        await client.sendText(`55${recipient2}@c.us`, messageBody);

        console.log('Notificações enviadas com sucesso via WhatsApp.');
    } catch (error) {
        console.error('Erro ao enviar notificação via WhatsApp:', error.message);
    }
}

// Função para obter dados das principais moedas
async function getMainCoinsData() {
    const mainCoinsSymbols = ['BTC', 'ETH', 'SOL', 'PEPE']; // Exemplos de moedas principais
    try {
        const response = await axios.get(
            'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
            {
                headers: {
                    'X-CMC_PRO_API_KEY': apiKey,
                },
                params: {
                    symbol: mainCoinsSymbols.join(','),
                    convert: 'USD',
                },
            }
        );

        const mainCoinsData = mainCoinsSymbols.map(symbol => response.data.data[symbol]);
        return mainCoinsData;
    } catch (error) {
        console.error('Erro ao obter dados das principais moedas:', error.message);
        return [];
    }
}

// Função para analisar memecoins com potencial
async function analyzePotentialMemecoins() {
    try {
        const response = await axios.get(
            'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
            {
                headers: {
                    'X-CMC_PRO_API_KEY': apiKey,
                },
                params: {
                    start: '1',
                    limit: '100', // Buscando as 100 principais moedas
                    convert: 'USD',
                },
            }
        );

        const data = response.data.data;

        // Filtrar moedas com base em capitalização, volume e crescimento em 7 dias
        const potentialMemecoins = data.filter(coin => {
            const marketCap = coin.quote.USD.market_cap;
            const volume24h = coin.quote.USD.volume_24h;
            const percentChange7d = coin.quote.USD.percent_change_7d;

            // Critérios de seleção para memecoins com maior potencial de crescimento
            return marketCap < 50000000 && volume24h > 100000 && percentChange7d > 10;
        });

        // Ordenar por variação em 7 dias (maior crescimento primeiro)
        potentialMemecoins.sort((a, b) => b.quote.USD.percent_change_7d - a.quote.USD.percent_change_7d);

        const bestMemecoin = potentialMemecoins[0]; // Moeda com maior crescimento em 7 dias

        return {
            bestMemecoin,
            potentialMemecoins
        };
    } catch (error) {
        console.error('Erro ao analisar memecoins:', error.message);
        return { bestMemecoin: null, potentialMemecoins: [] };
    }
}

// Função para recomendar a melhor criptomoeda para compra com base no volume e crescimento
async function recommendBestOption() {
    const { bestMemecoin, potentialMemecoins } = await analyzePotentialMemecoins();

    if (bestMemecoin) {
        // Critérios de recomendação
        const marketCap = bestMemecoin.quote.USD.market_cap;
        const volume24h = bestMemecoin.quote.USD.volume_24h;
        const percentChange7d = bestMemecoin.quote.USD.percent_change_7d;

        if (marketCap < 50000000 && volume24h > 100000 && percentChange7d > 20) {
            // Se a memecoin atender a critérios mais rigorosos, recomendamos como a melhor compra
            return bestMemecoin;
        }
    }

    // Se não atender aos critérios mais rígidos, recomenda-se a segunda melhor opção
    return potentialMemecoins.length > 1 ? potentialMemecoins[1] : bestMemecoin;
}

// Inicializar Venom e configurar o cron job
venom
    .create({
        session: 'my-session3',
        multidevice: true // Usando multidevice
    })
    .then(async client => {
        // Configurar cron job para rodar diariamente às 22:00
        cron.schedule('0 22 * * *', async () => {
            console.log('Iniciando análise diária de memecoins...');

            const bestOption = await recommendBestOption();
            const mainCoinsData = await getMainCoinsData();

            if (bestOption || mainCoinsData.length > 0) {
                await sendWhatsAppNotification(client, bestOption, [], mainCoinsData);
            } else {
                console.log('Nenhuma memecoin com potencial ou principais moedas encontradas.');
            }
        });

        // Executar imediatamente ao iniciar o script
        const bestOption = await recommendBestOption();
        const mainCoinsData = await getMainCoinsData();

        if (bestOption || mainCoinsData.length > 0) {
            await sendWhatsAppNotification(client, bestOption, [], mainCoinsData);
        } else {
            console.log('Nenhuma memecoin com potencial ou principais moedas encontradas.');
        }
    })
    .catch(error => {
        console.log('Erro ao iniciar o Venom:', error);
    });
