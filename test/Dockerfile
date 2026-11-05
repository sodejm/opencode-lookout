# Public multi-platform Node image; refresh the digest only in a reviewed change.
FROM node:26-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9
ARG CLI_VERSION
ARG CLI_PACKAGE
ARG CLI_INTEGRITY
RUN apt-get update && apt-get install --no-install-recommends -y expect ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /cli
RUN npm install --ignore-scripts --no-fund --no-audit --save-exact "${CLI_PACKAGE}@${CLI_VERSION}"
RUN CLI_PACKAGE="$CLI_PACKAGE" CLI_INTEGRITY="$CLI_INTEGRITY" node --input-type=module -e \
    'import fs from "node:fs"; const lock=JSON.parse(fs.readFileSync("package-lock.json")); if(lock.packages["node_modules/"+process.env.CLI_PACKAGE]?.integrity!==process.env.CLI_INTEGRITY) throw Error("CLI artifact mismatch");' \
    && ln -s "/cli/node_modules/${CLI_PACKAGE}/bin/opencode" /usr/local/bin/opencode
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-fund --no-audit
COPY . .
USER node
ENV HOME=/tmp/lookout-home
# Runtime smoke check only; integration success is determined by the process exit.
HEALTHCHECK --interval=30s --timeout=5s --retries=1 CMD node --version || exit 1
CMD ["node", "test/integration.mjs"]
