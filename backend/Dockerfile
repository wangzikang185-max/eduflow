FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B -ntp package
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 app && mkdir logs && chown app:app logs
COPY --from=build /app/target/xuexu-backend-2.0.0.jar app.jar
USER app
ENV SERVER_ADDRESS=0.0.0.0
EXPOSE 8081
ENTRYPOINT ["java","-jar","app.jar"]
