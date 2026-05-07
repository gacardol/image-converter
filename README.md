# Conversor de Imagens Amazon

Ferramenta que converte imagens de produtos para o padrão Amazon em lote. Faça upload de uma planilha com links de imagem e receba tudo convertido automaticamente.

## O que faz

1. **Upload** — Envie sua planilha (.xlsx, .csv) com links de imagem
2. **Detecta** — Sistema identifica automaticamente as colunas de imagem
3. **Processa** — Para cada imagem:
   - Remove o fundo → aplica fundo branco puro
   - Converte para .jpg
   - Redimensiona para 1600x1600px (mantém proporção, padding branco)
4. **Upload** — Envia imagens processadas para ImgBB (hosting gratuito)
5. **Gera** — Nova planilha idêntica à original, com URLs das imagens Amazon-ready

## Setup

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install

# Configurar .env
cp .env.example .env
# Adicionar IMGBB_API_KEY (pegar em https://api.imgbb.com/)

# Opcional: instalar rembg para remoção de fundo
pip install rembg[cli]
```

## Executar

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

Acesse http://localhost:5173

## Tech Stack

- **Frontend**: React + Tailwind + Vite
- **Backend**: Node.js + Express
- **Imagens**: Sharp (resize/convert) + rembg (background removal)
- **Excel**: ExcelJS
- **Hosting**: ImgBB (gratuito, opcional)
- **Zip**: Archiver

## Sem ImgBB?

Se não configurar a API key do ImgBB, as imagens são salvas localmente em `/output/images/` e os caminhos locais são colocados na planilha de saída.
