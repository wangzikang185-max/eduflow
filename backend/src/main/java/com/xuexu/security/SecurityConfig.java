package com.xuexu.security;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.xuexu.mapper.WorkspaceStore;
import java.nio.charset.StandardCharsets;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  SecretKeySpec jwtKey(@Value("${app.jwt-secret}") String secret) {
    if (secret.getBytes(StandardCharsets.UTF_8).length < 32)
      throw new IllegalStateException("JWT_SECRET 至少需要 32 字节随机密钥");
    return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
  }

  @Bean
  JwtEncoder encoder(SecretKeySpec key) {
    return new NimbusJwtEncoder(new ImmutableSecret<>(key));
  }

  @Bean
  JwtDecoder decoder(SecretKeySpec key, WorkspaceStore db) {
    NimbusJwtDecoder decoder =
        NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    OAuth2TokenValidator<Jwt> active =
        jwt -> {
          var u = db.one(USER, p("id", jwt.getSubject()));
          Object version = jwt.getClaim("ver");
          boolean valid =
              u != null
                  && version instanceof Number
                  && jwt.getExpiresAt() != null
                  && jwt.getIssuedAt() != null
                  && ((Number) u.get("enabled")).intValue() == 1
                  && ((Number) u.get("tokenVersion")).longValue() == ((Number) version).longValue();
          return valid
              ? OAuth2TokenValidatorResult.success()
              : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
        };
    decoder.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer("xuexu"), active));
    return decoder;
  }

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.csrf(c -> c.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers("/auth/login", "/health")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(
            o ->
                o.jwt(j -> {})
                    .authenticationEntryPoint(
                        (request, response, e) -> {
                          response.setStatus(401);
                          response.setContentType("application/json;charset=UTF-8");
                          response
                              .getWriter()
                              .write("{\"code\":0,\"msg\":\"请登录或重新登录\",\"data\":null}");
                        }))
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(
                    (request, response, x) -> {
                      response.setStatus(401);
                      response.setContentType("application/json;charset=UTF-8");
                      response.getWriter().write("{\"code\":0,\"msg\":\"请先登录\",\"data\":null}");
                    }));
    return http.build();
  }
}
