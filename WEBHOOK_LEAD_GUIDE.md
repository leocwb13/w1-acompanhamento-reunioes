# Guia de Configuração: Webhook de Leads (Clientes)

## Sistema Implementado

O sistema já está **100% funcional** e enviará automaticamente os dados de novos clientes para webhooks configuradas.

## Como Funciona

Quando você cria um novo cliente, o seguinte acontece automaticamente:

1. Cliente é salvo no banco de dados
2. Sistema dispara evento `client.created`
3. Evento entra na fila de webhooks
4. Trigger PostgreSQL chama automaticamente o dispatcher
5. Dispatcher envia payload para todas as webhooks ativas
6. Sistema registra logs de entrega com status e timing

## Payload Enviado

```json
{
  "event_id": "evt_1733123456789_abc123def",
  "event_type": "client.created",
  "timestamp": "2024-12-07T20:30:00.000Z",
  "test": false,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "João Silva",
    "email": "joao@empresa.com",
    "phone": "+5511999887766",
    "status": "prospecto",
    "risk_score": 0,
    "revenue_bracket": "10k-50k",
    "created_at": "2024-12-07T20:30:00.000Z"
  }
}
```

## Headers Enviados

Cada requisição inclui automaticamente:

- `Content-Type: application/json`
- `User-Agent: ClientHub-Webhooks/1.0`
- `X-Event-Type: client.created`
- `X-Delivery-ID: evt_xxxxx` (ID único da entrega)
- `X-Webhook-Signature: sha256=xxxxx` (assinatura HMAC-SHA256)
- `X-Webhook-Timestamp: 1733612345` (timestamp Unix)
- **+ Headers customizados** que você configurar

## Passos para Configurar

### 1. Preparar Endpoint Receptor

Crie um endpoint HTTPS que aceite POST requests:

```javascript
// Exemplo Node.js/Express
app.post('/webhook/leads', (req, res) => {
  const payload = req.body;
  const signature = req.headers['x-webhook-signature'];

  // Validar assinatura (recomendado)
  const expectedSignature = createHmacSha256(
    JSON.stringify(payload),
    'SEU_SECRET_KEY'
  );

  if (signature !== `sha256=${expectedSignature}`) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Processar lead
  console.log('Novo lead:', payload.data);

  // Responder com sucesso (200-299)
  res.json({ received: true });
});
```

### 2. Configurar Webhook na Interface

1. Acesse a aplicação e faça login
2. Vá para o **Painel de Webhooks** (Admin → Webhooks)
3. Clique em **"Add Webhook"**
4. Preencha:
   - **Nome**: "Integração CRM" (ou outro nome descritivo)
   - **URL**: `https://seu-dominio.com/webhook/leads`
   - **Método HTTP**: POST (padrão)
   - **Eventos**: Marque ✓ **Client Created**
   - **Headers** (opcional): Adicione se precisar de autenticação
     - Ex: `Authorization: Bearer SEU_TOKEN`
     - Ex: `X-API-Key: SUA_CHAVE`

5. Clique em **"Create"**
6. **IMPORTANTE**: Copie e guarde a **Secret Key** exibida
   - Você não conseguirá vê-la novamente
   - Use para validar assinaturas HMAC

### 3. Testar Webhook

#### Teste 1: Webhook de Teste
- No painel de webhooks, clique no botão **"Send Test"** (ícone de envio)
- Verifique se seu endpoint recebeu o payload de teste
- Confira os logs de entrega no painel

#### Teste 2: Criar Cliente Real
1. Acesse a lista de clientes
2. Clique em **"Add Client"**
3. Preencha os dados:
   - Nome: "João Teste"
   - Email: "teste@exemplo.com"
   - Telefone: "+5511999887766"
   - Faturamento: "10k-50k"
4. Salve
5. **Webhook será disparada automaticamente!**

### 4. Monitorar Entregas

No painel de webhooks, você pode:

- Ver estatísticas (total de entregas, sucessos, falhas)
- Visualizar logs detalhados (status code, tempo de resposta, payload)
- Ver fila de eventos pendentes
- Forçar reprocessamento de eventos pendentes

## Validação de Assinatura HMAC

Para garantir que as requisições vêm do seu sistema:

```javascript
const crypto = require('crypto');

function validateWebhookSignature(payload, signature, secretKey) {
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}

// Uso
const isValid = validateWebhookSignature(
  req.body,
  req.headers['x-webhook-signature'],
  'SUA_SECRET_KEY_COPIADA'
);
```

```python
import hmac
import hashlib
import json

def validate_webhook_signature(payload, signature, secret_key):
    expected_signature = hmac.new(
        secret_key.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()

    return signature == f"sha256={expected_signature}"
```

## Recursos Avançados

### Retry Automático

O sistema tenta reenviar automaticamente em caso de falha:
- Tentativa 1: Imediato
- Tentativa 2: Após 1 minuto
- Tentativa 3: Após 5 minutos
- Tentativa 4: Após 30 minutos
- Tentativa 5: Após 2 horas
- Tentativa 6+: Após 12 horas

Após 5 tentativas falhadas, o evento é marcado como "failed".

### Debounce Inteligente

Para evitar sobrecarga, o dispatcher tem um debounce de 2 segundos. Múltiplos eventos criados rapidamente são processados em batch.

### Força Reprocessamento

Se há eventos pendentes na fila, use o botão **"Force Process"** no painel para processar imediatamente.

### Desabilitar Webhook Temporariamente

Clique no ícone de power (⚡) para desabilitar/habilitar sem deletar a configuração.

## Outros Eventos Disponíveis

Além de `client.created`, você também pode receber:

- `client.updated` - Cliente atualizado (inclui valores anteriores)
- `client.deleted` - Cliente removido
- `client.status_changed` - Status mudou (prospecto → ativo)

## Solução de Problemas

### Webhook não dispara
1. Verifique se está **enabled** (ativo)
2. Verifique evento selecionado: **Client Created** deve estar marcado
3. Veja fila de eventos no painel
4. Use "Force Process" se há eventos pendentes

### Erro 401/403
- Verifique headers de autenticação customizados
- Confirme que seu endpoint permite POST
- Verifique CORS se aplicável

### Erro de timeout
- Seu endpoint deve responder em menos de 10 segundos
- Processe de forma assíncrona se necessário
- Responda 200 primeiro, processe depois

### URL inválida
- Use apenas HTTPS (HTTP não é permitido)
- URL deve ser válida e acessível publicamente
- Teste com curl primeiro

## Exemplo de Endpoint Completo

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

const WEBHOOK_SECRET = 'sua_secret_key_aqui';

app.post('/webhook/leads', async (req, res) => {
  try {
    // 1. Validar assinatura
    const signature = req.headers['x-webhook-signature'];
    const payload = req.body;

    const expectedSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== `sha256=${expectedSig}`) {
      console.error('Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. Verificar se é evento de teste
    if (payload.test) {
      console.log('Webhook de teste recebida');
      return res.json({ received: true, test: true });
    }

    // 3. Processar lead
    const lead = payload.data;
    console.log('Novo lead:', {
      id: lead.id,
      nome: lead.name,
      email: lead.email,
      telefone: lead.phone
    });

    // 4. Salvar no seu sistema/CRM
    // await salvarNoCRM(lead);

    // 5. Responder com sucesso
    res.json({
      received: true,
      lead_id: lead.id,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro processando webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Webhook endpoint rodando na porta 3000');
});
```

## Conclusão

O sistema está pronto! Basta:
1. Configurar sua webhook na interface
2. Copiar a secret key
3. Começar a criar clientes
4. Receber dados automaticamente

Qualquer cliente criado por qualquer meio (interface, API, importação) disparará a webhook automaticamente.
