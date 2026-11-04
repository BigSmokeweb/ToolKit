FROM node:24-bookworm-slim AS frontend
WORKDIR /src/client
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY server/LeadDesk.csproj server/
RUN dotnet restore server/LeadDesk.csproj
COPY server/ server/
RUN dotnet publish server/LeadDesk.csproj -c Release --no-restore -o /out /p:UseAppHost=false
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app/server
COPY --from=backend /out ./
COPY --from=frontend /src/client/dist /app/client/dist
RUN mkdir -p /app/server/.data/keys && chown -R $APP_UID /app
USER $APP_UID
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENV Urls=http://0.0.0.0:8080
EXPOSE 8080
ENTRYPOINT ["dotnet","LeadDesk.dll"]
