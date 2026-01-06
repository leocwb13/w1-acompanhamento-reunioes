/**
 * Servidor de Teste para Webhook de Leads
 *
 * Este é um servidor simples para testar o recebimento de webhooks.
 * Execute com: node test-webhook-receiver.js
 *
 * Para testar localmente, use ngrok ou similar para expor:
 * 1. Instale ngrok: npm install -g ngrok
 * 2. Execute este servidor: node test-webhook-receiver.js
 * 3. Em outro terminal: ngrok http 3000
 * 4. Use a URL HTTPS do ngrok na configuração da webhook
 */

const http = require('http');
const crypto = require('crypto');

// IMPORTANTE: Substitua pela secret key que você copiou ao criar a webhook
const WEBHOOK_SECRET = 'COLE_SUA_SECRET_KEY_AQUI';

const server = http.createServer((req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Signature, X-Webhook-Timestamp, X-Event-Type, X-Delivery-ID');

  // Handle OPTIONS para CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Aceitar apenas POST
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const payload = JSON.parse(body);

      console.log('\n' + '='.repeat(80));
      console.log('🎯 WEBHOOK RECEBIDA!');
      console.log('='.repeat(80));
      console.log('Timestamp:', new Date().toISOString());
      console.log('Event Type:', req.headers['x-event-type']);
      console.log('Delivery ID:', req.headers['x-delivery-id']);
      console.log('Signature:', req.headers['x-webhook-signature']);
      console.log('\n📦 PAYLOAD:');
      console.log(JSON.stringify(payload, null, 2));

      // Validar assinatura se a secret key foi configurada
      if (WEBHOOK_SECRET && WEBHOOK_SECRET !== 'COLE_SUA_SECRET_KEY_AQUI') {
        const receivedSignature = req.headers['x-webhook-signature'];
        const expectedSignature = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(body)
          .digest('hex');

        const isValid = receivedSignature === `sha256=${expectedSignature}`;

        console.log('\n🔐 VALIDAÇÃO DE ASSINATURA:');
        console.log('Válida:', isValid ? '✅ SIM' : '❌ NÃO');

        if (!isValid) {
          console.log('Recebida:', receivedSignature);
          console.log('Esperada:', `sha256=${expectedSignature}`);
          console.log('\n⚠️  ATENÇÃO: Assinatura inválida! Verifique a secret key.');
        }
      } else {
        console.log('\n⚠️  Secret key não configurada - validação de assinatura desabilitada');
        console.log('Configure WEBHOOK_SECRET no início do arquivo para habilitar validação');
      }

      // Se for um teste
      if (payload.test) {
        console.log('\n🧪 Este é um WEBHOOK DE TESTE');
      }

      // Se for um lead real
      if (payload.event_type === 'client.created' && payload.data) {
        console.log('\n👤 NOVO LEAD:');
        console.log('   ID:', payload.data.id);
        console.log('   Nome:', payload.data.name);
        console.log('   Email:', payload.data.email || 'N/A');
        console.log('   Telefone:', payload.data.phone || 'N/A');
        console.log('   Status:', payload.data.status);
        console.log('   Faturamento:', payload.data.revenue_bracket || 'N/A');
      }

      console.log('='.repeat(80) + '\n');

      // Responder com sucesso
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        received: true,
        event_id: payload.event_id,
        processed_at: new Date().toISOString(),
        message: 'Webhook processada com sucesso!'
      }));

    } catch (error) {
      console.error('❌ ERRO ao processar webhook:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 SERVIDOR DE TESTE DE WEBHOOK INICIADO');
  console.log('='.repeat(80));
  console.log(`Porta: ${PORT}`);
  console.log(`Endpoint: http://localhost:${PORT}`);
  console.log('\nPara testar localmente com o sistema:');
  console.log('1. Instale ngrok: npm install -g ngrok');
  console.log('2. Execute: ngrok http ' + PORT);
  console.log('3. Use a URL HTTPS do ngrok na configuração da webhook');
  console.log('4. Não esqueça de copiar a secret key após criar a webhook!');
  console.log('\n⚠️  IMPORTANTE: Configure a WEBHOOK_SECRET no arquivo para validar assinaturas');
  console.log('='.repeat(80) + '\n');
  console.log('Aguardando webhooks...\n');
});
