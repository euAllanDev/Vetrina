# syntax=docker/dockerfile:1

# ---------- Build ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B package && cp target/erp-backend-*.jar /app/app.jar

# ---------- Runtime ----------
FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache tzdata && addgroup -S erp && adduser -S erp -G erp
ENV TZ=America/Sao_Paulo
WORKDIR /app
COPY --from=build /app/app.jar app.jar
USER erp
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://localhost:8080/actuator/health | grep -q UP || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
