# LNReader — The Web Novel Haven

Repositório de plugins para LNReader contendo somente o plugin **The Web Novel Haven**.

O plugin lê novels coreanas traduzidas publicadas em [The Web Novel Haven](https://thewebnovelhaven.wordpress.com/). Ele busca o catálogo da página de novels, percorre as páginas de capítulos, oferece busca por título e extrai o conteúdo dos capítulos diretamente do WordPress.

## Instalação no LNReader

Adicione este índice nas fontes de plugins:

```text
https://raw.githubusercontent.com/jvpoke/lnreader-webnovelhaven-plugins/main/.dist/plugins.min.json
```

## Estrutura

- `.dist/plugins.min.json`: índice compacto consumido pelo LNReader.
- `.dist/plugins.json`: índice legível para inspeção.
- `.js/src/plugins/english/thewebnovelhaven.js`: implementação do plugin.
- `public/static/src/en/thewebnovelhaven/icon.png`: ícone do plugin.

O repositório não copia capítulos ou novels. Ele contém apenas o código do adaptador que lê o site no momento do uso.

## Fonte

Site: <https://thewebnovelhaven.wordpress.com/>

Formato de referência: índice de plugins LNReader v3.0.0.
