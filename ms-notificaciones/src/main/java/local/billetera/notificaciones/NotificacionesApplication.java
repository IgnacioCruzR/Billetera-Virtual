package local.billetera.notificaciones;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(InfrastructureProperties.class)
public class NotificacionesApplication {
    public static void main(String[] args) {
        try (var context = SpringApplication.run(NotificacionesApplication.class, args)) {
            context.getBean(InfrastructureProperties.class);
        }
    }
}
