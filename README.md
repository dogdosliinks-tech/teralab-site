# TeraLab

Site institucional da TeraLab — Soluções Inteligentes, no Vale do Aço (MG).

A TeraLab atua em duas frentes, com o mesmo peso:

- **Software:** sites, sistemas inteligentes, aplicativos e sistemas escolares
- **Impressão 3D:** troféus, medalhas, peças e presentes sob encomenda

## Endereço

- Site: https://dogdosliinks-tech.github.io/teralab-site/
- WhatsApp: https://wa.me/5531993535517
- Instagram: https://www.instagram.com/brenoteralab/

## Como visualizar localmente

O site é estático. Na pasta do projeto:

```bash
python3 -m http.server 8080
```

Abra http://127.0.0.1:8080/

O GitHub Pages publica a pasta raiz da branch `main`.

## Catálogo de impressão 3D

O catálogo fica em `products.json`. As fotos otimizadas estão em `img/catalogo/`. Categorias: Natal, Educação, Sensoriais, Bonecos, Utilidades e Personalizados.

Cada produto segue este formato:

```json
[
  {
    "id": "presepio-anjo",
    "name": "Presépio com Anjo",
    "category": "Natal",
    "description": "Presépio de Natal com anjo, Maria, José e o Menino Jesus.",
    "price": 29.9,
    "image": "img/catalogo/presepio-anjo.webp",
    "priceFrom": false,
    "illustrative": false
  }
]
```

- `id`: texto único
- `name`, `category`, `description`: textos
- `price`: número em reais, ou `null` para “Sob consulta”
- `priceFrom` (opcional): se verdadeiro, o preço aparece como “A partir de R$ …”
- `illustrative` (opcional): se verdadeiro, a foto exibe o selo “Imagem ilustrativa”
- `image` (opcional): caminho relativo da foto

Peças com valor sob consulta abrem o WhatsApp com a mensagem pronta, em vez de irem para a sacola. O pedido da sacola e o formulário de encomenda também abrem o WhatsApp para revisão. Nada é enviado sozinho.

## Contato

O atendimento é pelo WhatsApp informado acima. O Instagram @brenoteralab aparece no rodapé.
