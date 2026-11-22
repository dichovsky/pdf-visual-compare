FROM node:26-slim AS deps

WORKDIR /usr/pkg

COPY package*.json ./
RUN npm ci

FROM node:26-slim

WORKDIR /usr/pkg

RUN useradd --create-home --uid 10001 --user-group app

COPY --from=deps /usr/pkg/node_modules ./node_modules
COPY --chown=app:app src ./src
COPY --chown=app:app __tests__ ./__tests__
COPY --chown=app:app scripts ./scripts
COPY --chown=app:app test-data ./test-data
COPY --chown=app:app vitest.config.mjs ./
COPY --chown=app:app tsconfig.json package.json README.md ./

RUN chown -R app:app /usr/pkg

USER app

CMD ["./node_modules/.bin/vitest", "run"]
