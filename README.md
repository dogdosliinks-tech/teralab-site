# TeraLab

Site institucional da TeraLab — Soluções Inteligentes, no Vale do Aço (MG).

A TeraLab atua em duas frentes, com o mesmo peso:

- **Software:** sites, sistemas inteligentes, aplicativos e sistemas escolares
- **Impressão 3D:** troféus, medalhas, peças e presentes sob encomenda

## Endereço

- Site: https://dogdosliinks-tech.github.io/teralab-site/
- WhatsApp: https://wa.me/5531993535517

## Como visualizar localmente

O site é estático. Na pasta do projeto:

```bash
python3 -m http.server 8080
```

Abra http://127.0.0.1:8080/

O GitHub Pages publica a pasta raiz da branch `main`.

## Catálogo de impressão 3D

O arquivo `products.json` começa vazio. Enquanto não houver produtos, o catálogo e a sacola ficam ocultos.

Para exibir o catálogo, inclua um array de produtos, por exemplo:

```json
[
  {
    "id": "trofeu-estrela",
    "name": "Troféu Estrela",
    "category": "Troféus e medalhas",
    "description": "Troféu personalizado para premiações.",
    "price": null,
    "image": "fotos/trofeu-estrela.jpg"
  }
]
```

- `id`: texto único
- `name`, `category`, `description`: textos
- `category`: `Troféus e medalhas`, `Peças e utilidades` ou `Presentes`
- `price`: número em reais, ou `null` para “sob consulta”
- `image` (opcional): caminho relativo da foto

O pedido da sacola e o formulário de encomenda abrem o WhatsApp com a mensagem pronta para revisão. Nada é enviado sozinho.

## Contato

O site usa apenas o WhatsApp informado acima. Não há e-mail ou redes sociais cadastrados nesta versão.
