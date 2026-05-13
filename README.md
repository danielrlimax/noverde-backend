# SolVerde Backend API

Backend completo e seguro para a plataforma SolVerde de energia solar.

## 🚀 Tecnologias

- **Node.js 18+** - Runtime
- **Express 4** - Framework web
- **TypeScript** - Tipagem estática
- **Supabase** - Banco de dados PostgreSQL
- **JWT** - Autenticação
- **bcrypt** - Hash de senhas
- **Helmet** - Headers de segurança
- **Rate Limiting** - Proteção contra DDoS
- **Winston** - Logging
- **Nodemailer** - Envio de e-mails

## 📋 Pré-requisitos

- Node.js 18 ou superior
- Conta no Supabase
- SMTP para envio de e-mails (opcional em dev)

## 🔧 Instalação

### 1. Clone e instale dependências

```bash
cd backend
npm install
```

### 2. Configure o Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Vá em **SQL Editor** e execute o conteúdo do arquivo `supabase/schema.sql`
3. Copie as credenciais em **Settings > API**

### 3. Configure variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# JWT (gere chaves seguras)
JWT_SECRET=sua-chave-secreta-64-caracteres
JWT_REFRESH_SECRET=outra-chave-secreta-64-caracteres
ENCRYPTION_KEY=chave-de-32-caracteres-exatos!!

# E-mail (opcional em dev)
SMTP_HOST=smtp.gmail.com
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://seusite.com
```

### 4. Gere chaves seguras

```bash
# JWT Secret (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Encryption Key (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"
```

### 5. Inicie o servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

## 📚 Endpoints da API

### Autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/auth/register` | Cadastro de usuário |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| POST | `/api/v1/auth/refresh` | Renovar token |
| GET | `/api/v1/auth/me` | Dados do usuário logado |
| POST | `/api/v1/auth/forgot-password` | Solicitar reset de senha |
| POST | `/api/v1/auth/reset-password` | Redefinir senha |
| POST | `/api/v1/auth/change-password` | Alterar senha (logado) |

### Leads

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/v1/leads` | Criar lead | Público |
| GET | `/api/v1/leads` | Listar leads | Admin/Manager/Operator |
| GET | `/api/v1/leads/:id` | Buscar lead | Admin/Manager/Operator |
| PATCH | `/api/v1/leads/:id` | Atualizar lead | Admin/Manager/Operator |
| GET | `/api/v1/leads/stats` | Estatísticas | Admin/Manager |

### Simulações

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/v1/simulations/calculate` | Calcular simulação | Público |
| GET | `/api/v1/simulations/lead/:id` | Simulações de um lead | Staff |
| GET | `/api/v1/simulations/stats` | Estatísticas | Admin/Manager |

### Contatos

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/v1/contacts` | Enviar mensagem | Público |
| GET | `/api/v1/contacts` | Listar mensagens | Admin/Manager |
| PATCH | `/api/v1/contacts/:id/respond` | Marcar respondido | Admin/Manager |

### Newsletter

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/v1/newsletter/subscribe` | Inscrever | Público |
| POST | `/api/v1/newsletter/unsubscribe` | Cancelar | Público |
| GET | `/api/v1/newsletter` | Listar inscritos | Admin/Manager |

## 🔒 Segurança Implementada

### Headers HTTP (Helmet)
- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- HSTS
- E mais...

### Rate Limiting
- **Geral**: 100 req/15min por IP
- **Login**: 5 tentativas/15min por IP+email
- **E-mails**: 5 envios/hora por IP
- **Simulações**: 20/min por IP

### Autenticação
- JWT com expiração (1 dia access, 7 dias refresh)
- Blacklist de tokens revogados
- Hash bcrypt (12 rounds)
- Sessões rastreadas por IP

### Dados
- Sanitização de inputs (XSS, SQL Injection)
- Validação com express-validator
- Criptografia AES-256-GCM para dados sensíveis
- Logs de auditoria completos

### CORS
- Origens permitidas configuráveis
- Credentials habilitado
- Preflight cacheado (24h)

## 📊 Banco de Dados

### Tabelas Principais

- `users` - Usuários do sistema
- `sessions` - Sessões ativas
- `leads` - Leads captados
- `simulations` - Simulações realizadas
- `contacts` - Mensagens de contato
- `newsletter_subscribers` - Inscritos na newsletter
- `blog_posts` - Posts do blog
- `blog_categories` - Categorias do blog
- `webinars` - Webinars agendados
- `audit_logs` - Log de auditoria
- `token_blacklist` - Tokens invalidados
- `password_resets` - Tokens de reset de senha

### Row Level Security (RLS)

Todas as tabelas têm RLS habilitado com políticas específicas:
- Usuários só veem seu próprio perfil
- Operadores só veem leads atribuídos a eles
- Posts publicados são públicos
- Audit logs só para admins

## 🚀 Deploy

### Heroku

```bash
heroku create solverde-api
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=...
# ... configure todas as variáveis
git push heroku main
```

### Railway

```bash
railway login
railway init
railway up
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

### Variáveis de Produção

```env
NODE_ENV=production
PORT=3001
CORS_ALLOWED_ORIGINS=https://solverde.com.br
LOG_LEVEL=warn
```

## 📝 Logs

- **Desenvolvimento**: Console colorido
- **Produção**: Arquivos rotativos + JSON
- **Níveis**: error, warn, info, debug

```bash
# Ver logs em produção
tail -f logs/app.log
```

## 🧪 Testes

```bash
# Executar testes
npm test

# Com coverage
npm run test:coverage
```

## 📈 Monitoramento

### Health Check

```
GET /api/v1/health
```

### Métricas recomendadas
- Tempo de resposta
- Taxa de erros
- Uso de memória
- Conexões ativas

## 🔄 Manutenção

### Limpeza de tokens expirados

O Supabase pode agendar a função `cleanup_expired_tokens()`:

1. Vá em **Database > Functions**
2. Crie um cron job diário

```sql
SELECT cleanup_expired_tokens();
```

### Backup

Configure backups automáticos no painel do Supabase.

## 📄 Licença

Proprietário - SolVerde Energia Solar

## 👥 Suporte

- Email: suporte@solverde.com.br
- Docs: /api/v1/docs (em desenvolvimento)
