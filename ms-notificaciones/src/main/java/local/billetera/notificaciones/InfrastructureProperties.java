package local.billetera.notificaciones;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("billetera")
public record InfrastructureProperties(int grpcPort, Postgres postgres) {
    public record Postgres(String host, int port, String database, String user, String password) {
        @Override
        public String toString() {
            return "Postgres[host=" + host + ", port=" + port + ", database=" + database + "]";
        }
    }
}
