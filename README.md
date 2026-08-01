# Cadimus — Gestor Financeiro

PWA completa para controle financeiro pessoal e familiar. Construída com Cloudflare Workers, D1 Database e frontend vanilla JS.

## Acesse

| Ambiente | URL |
|---|---|
| **Produção** | [cadimus.pages.dev](https://cadimus.pages.dev) |
| **Staging** | [staging.cadimus.pages.dev](https://staging.cadimus.pages.dev) |

---

## Funcionalidades

### Dashboard
- Cards de Saldo, Despesas, Pendências e Atrasados
- Score de saúde financeira (0-100) com anel SVG animado
- Gráfico de categorias (donut) em "Para onde foi o dinheiro"
- Evolução mensal (SVG line chart) — Receitas vs Despesas
- Notificações de vencimento com badge vermelho no sino
- Comparativo por período (Mês/Trimestre/Ano)

### Lançamentos
- Cadastro de receitas e despesas com data, categoria, descrição, valor e nota
- Filtros avançados: tipo, status (pago/pendente/atrasado) e categoria (lógica AND)
- Busca por descrição ou categoria
- Agrupamento automático por período (Hoje, Ontem, Esta semana, Semana passada, Este mês, Mês passado, Mais antigo)
- Colapso/expandir grupos de data
- Edição em lote (até 50 lançamentos por vez)

### Despesas Fixas
- Cadastro com dia de vencimento e categoria
- Pagamento mensal com histórico
- Atrasado automaticamente quando não pago
- Geração automática na virada do mês
- Layout com status colorido (Pago=verde, Pendente=amarelo, Atrasado=vermelho)

### Compras Parceladas
- Cadastro com número de parcelas e data inicial
- Toggle play/pause para pausar temporariamente
- Histórico de pagamentos por parcela
- Vinculação a cartão de crédito

### Cartões de Crédito
- CRUD completo (criar, editar, excluir)
- Bandeira com cores (Visa, Mastercard, Elo, Amex, etc.)
- Limite, data de fechamento e vencimento
- Barra de utilização com gasto atual vs limite
- Parcelas ativas vinculadas

### Lançamentos Recorrentes
- Frequência semanal, quinzenal, mensal, trimestral ou anual
- Geração automática dos próximos lançamentos

### Transferências entre Carteiras
- Transferência de valores entre contas
- Histórico de transferências

### Planejamento Financeiro (7 abas)
- **Resumo**: KPIs, salário, indicadores financeiros, alertas inteligentes
- **Orçamento**: Orçamento por categoria com barras de progresso
- **Metas**: Metas financeiras com depósito e progresso
- **Receitas**: Receitas planejadas com status
- **Despesas**: Fixas + Parceladas consolidadas
- **Comparar**: Comparação planejado × real + recomendações
- **Simular**: Calculadora de economia (12/24/60 meses)

### Relatórios Financeiros (7 abas)
- **Resumo**: 6 KPIs com tendências + Fluxo de Caixa SVG + Barras Receitas×Despesas + Donut + 10 Indicadores
- **Categorias**: Evolução por categoria (linhas SVG) + Ranking com barras
- **Contas**: Tabela por conta + Tabela por forma de pagamento
- **Detalhes**: Maiores despesas/receitas + Gastos recorrentes
- **Comparativo**: Período atual × anterior + Progresso de metas
- **Insights**: Análises automáticas (gasto > receita, categorias com variação, fixas > 60%)
- **Tabela**: Tabela completa com busca, ordenação e paginação
- Filtros: período (hoje/semana/mês/3m/6m/ano/personalizado), carteira, categoria, tipo
- Exportação: PDF (impressão), CSV, JSON

### Notificações
- Avisos de vencimento para fixas, parceladas e lançamentos pendentes
- Badge vermelho que persiste até itens serem pagos
- Modal popup ao clicar no sino

### Carteiras
- Carteira pessoal automática para cada usuário
- Carteiras compartilhadas com membros (admin/membro)
- Reordenação por drag-and-drop
- Troca instantânea entre carteiras

### Importação e Exportação
- Importação de extratos bancários (OFX e CSV)
- Importação em lote com `Promise.allSettled` (batches de 10)
- Exportação em CSV e OFX

### Configurações (Layout modular com sidebar)
- **Perfil**: Foto, nome, email, telefone, salário, perfil, senha
- **Contas**: Carteiras (adicionar/editar)
- **Cartões**: Cartões de crédito
- **Categorias**: CRUD com busca
- **Metas**: Metas financeiras
- **Orçamentos**: Orçamentos por categoria
- **Recorrências**: Lançamentos recorrentes
- **Usuários**: Lista + convidar (só admin)
- **Tema**: Claro/Escuro/Automático + toggles (animações, ocultar valores)
- **Dados**: Importar/Exportar
- **Sistema**: Versão, banco, hospedagem
- **Zona de Perigo**: Apagar dados financeiros

### Administração (Superadmin)
- Gerenciamento de usuários (criar, editar, excluir)
- Sistema de convites com link expirante (3 horas)
- Visibilidade por criador (`criado_por` — superadmin vê tudo)
- Usuários convidados recebem carteira pessoal automática

### Acessibilidade
- WCAG AA contrast (`--cor-texto-suave: #3d4d3f` = 5.2:1)
- ARIA `role="dialog"` e `aria-modal="true"` em todos os modais (23+)
- Trapping de foco em modais
- Redução de animação para quem tem `prefers-reduced-motion`
- Alt text em imagens
- Navegação por teclado

### Segurança
- Sanitização de URLs (`sanitizarUrl()` — http/https only)
- Event delegation (sem inline `onclick`)
- Remoção de `erro.message` de respostas (39 ocorrências em 14 arquivos)
- Content Security Policy via `_headers`
- XSS protection via escaping de HTML

### Extras
- PWA instalável (manifest + service worker com cache v4 + stale-while-revalidate)
- Offline fallback page
- Onboarding interativo (tour guiado com 5 steps)
- Animação de contagem nos valores monetários
- Toast de feedback para ações
- Modais customizados (substitui alert/confirm do navegador)
- Debounce de 250ms na busca
- Fonts reduzidas (IBM Plex Sans + IBM Plex Mono)
- Rodapé único com brand, versão, usuário e links

---

## Stack Tecnológica

### Frontend
- **HTML/CSS/JS** vanilla (sem frameworks)
- CSS custom properties para design tokens
- Service Worker com stale-while-revalidate
- PWA com manifest e ícones maskable
- Gráficos SVG (donut, line chart, bar chart)

### Backend
- **Cloudflare Workers** (edge computing)
- **Cloudflare D1** (SQLite serverless)
- Roteamento manual com padrão de rotas otimizadas (GROUP BY + IN)

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
│   ├── offline.html            # Fallback offline
│   ├── _headers                # CSP + security headers
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker (cache v4)
│   ├── css/
│   │   ├── variables.css       # Design tokens
│   │   └── style.css           # Estilos globais (~6000 linhas)
│   ├── js/
│   │   ├── auth.js             # Autenticação, sessão, sanitização
│   │   ├── main.js             # Lógica principal (~7000 linhas)
│   │   ├── components.js       # Componentes reutilizáveis
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
│       │   ├── usuarios.js     # CRUD de usuários (filtro por criado_por)
│       │   ├── carteiras.js    # CRUD de carteiras
│       │   ├── lancamentos.js  # CRUD + filtros + batch
│       │   ├── despesasFixas.js
│       │   ├── comprasParceladas.js
│       │   ├── lancamentosRecorrentes.js
│       │   ├── categorias.js
│       │   ├── metas.js        # Metas de economia (GROUP BY)
│       │   ├── planos.js       # Planos financeiros (GROUP BY)
│       │   ├── convites.js     # Sistema de convites
│       │   ├── transferencias.js # Transferências entre carteiras
│       │   ├── orcamentos.js   # Orçamentos por categoria
│       │   ├── cartoesCredito.js # Cartões de crédito
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
    └── migrations/             # 28 migrações SQL (0001-0028)
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
# Aplicar migrações individualmente
wrangler d1 execute cadimus-db --remote --file=../database/migrations/0001_initial.sql
wrangler d1 execute cadimus-db --remote --file=../database/migrations/0028_cartoes_credito.sql

# Aplicar todas de uma vez
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

### Branches

| Branch | Ambiente | URL |
|---|---|---|
| `main` | Produção | cadimus.pages.dev |
| `staging` | Preview | staging.cadimus.pages.dev |

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

## Migrações

| Migração | Descrição |
|---|---|
| 0001 | Tabelas iniciais (usuarios, categorias, lancamentos) |
| 0002 | Dados iniciais (categorias padrão) |
| 0003-0010 | Carteiras, despesas fixas, compras parceladas |
| 0011-0015 | Recorrências, notificações, metas |
| 0016-0020 | Planos financeiros, `criado_por`, campo nota |
| 0021-0022 | Sistema de convites, `criado_por` FK |
| 0023-0025 | Metas com prazo, planos com ícone/cor |
| 0026 | Transferências entre carteiras |
| 0027 | Orçamentos mensais por categoria |
| 0028 | Cartões de crédito + FK em compras_parceladas |

---

## Licença

Projeto privado. Todos os direitos reservados.

---

**Desenvolvimento por [Olinbyte Digital](https://olinbytedigital.pages.dev/)**
