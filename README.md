# Cadimus — Gestor Financeiro

PWA completa para controle financeiro pessoal e familiar. Construída com Cloudflare Workers, D1 Database e frontend vanilla JS.

## Acesse

| Ambiente | URL |
|---|---|
| **Produção** | [cadimus.pages.dev](https://cadimus.pages.dev) |
| **Staging** | [staging.cadimus.pages.dev](https://staging.cadimus.pages.dev) |

---

## Funcionalidades

### Lançamentos
- Cadastro de receitas e despesas com data, categoria, descrição, valor e nota
- Filtros por tipo, status (pago/pendente/atrasado) e categoria
- Busca por descrição ou categoria
- Agrupamento automático por período (Hoje, Ontem, Esta semana, etc.)
- Colapso/expandir grupos de data
- Edição em lote (até 50 lançamentos por vez)

### Despesas Fixas
- Cadastro com dia de vencimento e categoria
- Pagamento mensal com histórico
- Atrasado automaticamente quando não pago
- Geração automática na virada do mês

### Compras Parceladas
- Cadastro com número de parcelas e data inicial
- Toggle play/pause para pausar temporariamente
- Histórico de pagamentos por parcela

### Lançamentos Recorrentes
- Frequência semanal, quinzenal, mensal, trimestral ou anual
- Geração automática dos próximos lançamentos

### Planejamento Financeiro
- **Metas**: defina valores-alvo por categoria com prazo e depósitos
- **Planos**: projetos com ícone, cor, prioridade, deadline e compartilhamento
- **Distribuição mensal**: visualiza fixas + parcelas + planos ativos + sobra
- **Capacidade de guarda**: cálculo automático baseado no salário
- **Taxa de poupança**: percentual de economia mensal

### Dashboard
- Cards de Saldo, Despesas, Saldo do período, Capacidade de guarda e Taxa de poupança
- Comparativo por período (Mês/Trimestre/Ano) com variação percentual
- Gráfico de barras comparativo 6 meses (Saldo vs Despesas)
- Raio-x de categorias com ranking

### Notificações
- Avisos de vencimento para fixas, parceladas e lançamentos pendentes
- Notificação semanal para metas com prazo
- Badge vermelho que persiste até itens serem pagos
- Modal popup ao clicar no sino

### Carteiras
- Carteira pessoal automática para cada usuário
- Carteiras compartilhadas com membros (admin/membro)
- Reordenação por drag-and-drop
- Troca instantânea entre carteiras

### Importação e Exportação
- Importação de extratos bancários (OFX e CSV)
- Exportação em CSV e OFX
- Resumo por período na exportação

### Administração (Superadmin)
- Gerenciamento de usuários (criar, editar, excluir)
- Painel de categorias
- Sistema de convites com link expirante (3 horas)
- Visibilidade por criador (superadmin vê tudo)

### Perfil do Usuário
- Edição de nome, e-mail, telefone, foto de perfil e senha
- Campo de salário para cálculos de planejamento
- Avatar no header com dropdown (Perfil, Configurações, Sair)

### Extras
- Modo escuro/claro com toggle
- PWA instalável (manifest + service worker)
- Animação de contagem nos valores monetários
- Toast de feedback para ações
- Modais customizados (substitui alert/confirm do navegador)
- Trapping de foco em modais (acessibilidade)
- Redução de animação para quem tem `prefers-reduced-motion`

---

## Stack Tecnológica

### Frontend
- **HTML/CSS/JS** vanilla (sem frameworks)
- CSS custom properties para design tokens
- Service Worker com stale-while-revalidate
- PWA com manifest e ícones maskable

### Backend
- **Cloudflare Workers** (edge computing)
- **Cloudflare D1** (SQLite serverless)
- Roteamento manual com padrão de rotas

### Segurança
- Hash de senhas com **PBKDF2** (100.000 iterações)
- Comparação constante de tempo contra timing attacks
- Rate limiting no login (5 tentativas / 15 min)
- Sessões com limpeza automática (24h)
- Tokens de recuperação de senha com expiração (30 min)
- Escape HTML para prevenir XSS
- CORS configurável por origem

### Infraestrutura
- **Cloudflare Pages** para frontend (deploy automático via Git)
- **Cloudflare Workers** para backend
- **Cloudflare D1** para banco de dados
- **Resend** para envio de e-mails (recuperação de senha)

---

## Estrutura do Projeto

```
Cadimus/
├── frontend/
│   ├── index.html              # SPA principal
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker
│   ├── css/
│   │   ├── variables.css       # Design tokens
│   │   └── style.css           # Estilos globais
│   ├── js/
│   │   ├── auth.js             # Autenticação e sessão
│   │   ├── main.js             # Lógica principal da aplicação
│   │   ├── components.js       # Componentes reutilizáveis (linhas de lançamento)
│   │   ├── importar.js         # Importação OFX/CSV
│   │   ├── exportar.js         # Exportação CSV/OFX
│   │   └── recorrentes.js      # Lançamentos recorrentes
│   └── assets/
│       ├── logo.png            # Logo do app
│       ├── icon-192.png        # Ícone PWA 192x192
│       ├── icon-512.png        # Ícone PWA 512x512
│       └── icon-512-maskable.png
├── backend/
│   ├── package.json
│   ├── wrangler.toml           # Configuração Cloudflare Workers
│   └── src/
│       ├── index.js            # Entry point e rotas
│       ├── routes/
│       │   ├── auth.js         # Login/logout/recuperação de senha
│       │   ├── usuarios.js     # CRUD de usuários
│       │   ├── carteiras.js    # CRUD de carteiras
│       │   ├── lancamentos.js  # CRUD + filtros + batch
│       │   ├── despesasFixas.js
│       │   ├── comprasParceladas.js
│       │   ├── lancamentosRecorrentes.js
│       │   ├── categorias.js
│       │   ├── metas.js        # Metas de economia
│       │   ├── planos.js       # Planos financeiros
│       │   ├── convites.js     # Sistema de convites
│       │   ├── expenses.js
│       │   └── manutencao.js
│       └── utils/
│           ├── crypto.js       # PBKDF2 + comparação segura
│           ├── sessao.js       # Gerenciamento de sessões
│           ├── email.js        # Envio via Resend
│           ├── carteiras.js    # Utilitários de carteiras
│           ├── despesasFixas.js
│           ├── comprasParceladas.js
│           └── lancamentosRecorrentes.js
└── database/
    └── migrations/             # 25 migrações SQL (0001-0025)
```

---

## Setup para Desenvolvimento

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v18+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Conta no [Cloudflare](https://dash.cloudflare.com/)
- Conta no [Resend](https://resend.com/) (para envio de e-mails)

### Backend

```bash
cd backend
npm install

# Configurar segredo da Resend
wrangler secret put RESEND_API_KEY

# Rodar localmente
npm run dev
```

O backend estará disponível em `http://localhost:8787`.

### Frontend

O frontend é estático. Basta servir a pasta `frontend/` com qualquer servidor HTTP:

```bash
cd frontend
npx serve .
# ou
python -m http.server 3000
```

### Banco de Dados

As migrações são aplicadas automaticamente no deploy. Para rodar manualmente:

```bash
# Aplicar todas as migrações
wrangler d1 execute cadimus-db --remote --file=../database/migrations/0001_initial.sql
wrangler d1 execute cadimus-db --remote --file=../database/migrations/0002_dados_iniciais.sql
# ... etc

# Ou aplicar todas de uma vez (produção)
wrangler d1 migrations apply cadimus-db --remote
```

### Deploy

**Backend:**
```bash
cd backend
npm run deploy
```

**Frontend:**
O deploy automático acontece a cada push na branch `staging` (preview) ou `main` (produção) via Cloudflare Pages.

---

## Variáveis de Ambiente

### Backend (wrangler.toml)

| Variável | Descrição |
|---|---|
| `FRONTEND_URL` | URLs permitidas (separadas por vírgula) |
| `EMAIL_REMETENTE` | Remetente dos e-mails |
| `RESEND_API_KEY` | Chave da API Resend (segredo) |

### Backend (.dev.vars para desenvolvimento)

```
RESEND_API_KEY=re_sua_chave_aqui
```

---

## Branches

| Branch | Ambiente | URL |
|---|---|---|
| `main` | Produção | cadimus.pages.dev |
| `staging` | Preview | staging.cadimus.pages.dev |

---

## Licença

Projeto privado. Todos os direitos reservados.
