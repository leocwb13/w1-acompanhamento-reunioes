# Teste de Webhook - Guia de Diagnóstico

## 1. Verificar se há eventos na fila

Execute no SQL Editor do Supabase:

```sql
SELECT
  id,
  event_type,
  event_id,
  payload,
  status,
  attempts,
  created_at,
  scheduled_for
FROM webhook_events_queue
ORDER BY created_at DESC
LIMIT 10;
```

## 2. Verificar logs de entrega

```sql
SELECT
  id,
  event_type,
  event_id,
  payload,
  status_code,
  success,
  error_message,
  response_body,
  attempt_number,
  created_at
FROM webhook_delivery_logs
ORDER BY created_at DESC
LIMIT 10;
```

## 3. Verificar configuração do webhook

```sql
SELECT
  id,
  name,
  url,
  enabled,
  events,
  headers,
  http_method,
  failure_count,
  last_triggered_at
FROM webhook_configurations;
```

## 4. Criar um cliente de teste manualmente

Execute no SQL Editor para criar um evento de teste:

```sql
-- Inserir um evento de teste na fila
INSERT INTO webhook_events_queue (
  webhook_config_id,
  event_type,
  event_id,
  payload,
  status,
  scheduled_for
)
SELECT
  id as webhook_config_id,
  'client.created' as event_type,
  'evt_test_' || gen_random_uuid()::text as event_id,
  jsonb_build_object(
    'event_id', 'evt_test_' || gen_random_uuid()::text,
    'event_type', 'client.created',
    'timestamp', now(),
    'test', true,
    'data', jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Cliente Teste',
      'email', 'teste@email.com',
      'phone', '11999999999',
      'status', 'ativo',
      'risk_score', 50,
      'revenue_bracket', 'R$ 10k-50k',
      'created_at', now()
    )
  ) as payload,
  'pending' as status,
  now() as scheduled_for
FROM webhook_configurations
WHERE enabled = true
LIMIT 1;
```

## 5. Verificar status do dispatcher

```sql
SELECT * FROM get_webhook_dispatcher_status();
```

## 6. Verificar última execução do dispatcher

```sql
SELECT
  id,
  triggered_by,
  started_at,
  completed_at,
  events_processed,
  success,
  error_message,
  request_id,
  http_status
FROM webhook_dispatcher_runs
ORDER BY started_at DESC
LIMIT 10;
```

## 7. Forçar processamento manual

Na interface de Webhooks, clique no botão **"Force Process"** para processar imediatamente.

## 8. Exemplo de payload que DEVE chegar no n8n

Quando tudo estiver funcionando, o n8n deve receber um payload assim:

```json
{
  "event_id": "evt_1733598000_abc123",
  "event_type": "client.created",
  "timestamp": "2024-12-07T20:00:00Z",
  "test": false,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "status": "ativo",
    "risk_score": 45,
    "revenue_bracket": "R$ 10k-50k",
    "created_at": "2024-12-07T20:00:00Z"
  }
}
```

## Troubleshooting

### Webhook não está disparando

1. ✅ Verificar se o webhook está **enabled** (ativo)
2. ✅ Verificar se o evento correto está selecionado (`client.created`, `client.updated`, etc.)
3. ✅ Verificar se há eventos na fila (`webhook_events_queue`)
4. ✅ Verificar se o dispatcher está rodando (`get_webhook_dispatcher_status()`)

### Webhook dispara mas payload está vazio/errado

1. ✅ Verificar o payload na tabela `webhook_events_queue`
2. ✅ Verificar o payload nos `webhook_delivery_logs`
3. ✅ Se o payload estiver correto no banco mas vazio no n8n, o problema é no n8n

### Status 401/403 no n8n

1. ✅ Verificar se o n8n está configurado para aceitar webhooks
2. ✅ Remover autenticação do webhook no n8n (ou configurar headers personalizados)

### Como configurar headers no webhook

Se o n8n precisa de autenticação, adicione headers personalizados:

1. Edite o webhook
2. Adicione header: `Authorization` com valor `Bearer SEU_TOKEN`
3. Ou outro header que o n8n espera

## Teste Rápido End-to-End

1. Crie um cliente novo na interface
2. Vá para a aba Webhooks
3. Verifique o painel "Automatic Webhook Dispatcher"
4. Deve mostrar "1 Pending Events" imediatamente
5. Após 2-5 segundos, o contador deve voltar a 0
6. Clique no ícone "Eye" do seu webhook para ver os logs
7. Deve aparecer uma entrega com status 200 (sucesso)
8. Se não aparecer, clique em "Force Process"

## Consultar n8n

No n8n, vá para:
1. Workflow com webhook
2. Clique no node webhook
3. Veja a aba "Executions"
4. Deve aparecer as execuções com os payloads recebidos
