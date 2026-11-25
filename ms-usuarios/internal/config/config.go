package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	GRPCPort     int
	Postgres     *pgxpool.Config
	KafkaBrokers []string
}

func valueOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func port(name, fallback string) (int, error) {
	number, err := strconv.Atoi(valueOrDefault(name, fallback))
	if err != nil || number < 1 || number > 65535 {
		return 0, fmt.Errorf("%s debe ser un puerto válido", name)
	}
	return number, nil
}

func Load() (Config, error) {
	for _, variable := range []string{"POSTGRES_HOST", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD", "KAFKA_BROKERS"} {
		if strings.TrimSpace(os.Getenv(variable)) == "" {
			return Config{}, fmt.Errorf("falta %s", variable)
		}
	}
	grpcPort, err := port("GRPC_PORT", "50051")
	if err != nil {
		return Config{}, err
	}
	postgresPort, err := port("POSTGRES_PORT", "5432")
	if err != nil {
		return Config{}, err
	}
	sslmode := valueOrDefault("POSTGRES_SSLMODE", "verify-full")
	connection := url.URL{
		Scheme:   "postgresql",
		User:     url.UserPassword(os.Getenv("POSTGRES_USER"), os.Getenv("POSTGRES_PASSWORD")),
		Host:     net.JoinHostPort(os.Getenv("POSTGRES_HOST"), strconv.Itoa(postgresPort)),
		Path:     "/" + os.Getenv("POSTGRES_DB"),
		RawQuery: url.Values{"sslmode": {sslmode}}.Encode(),
	}
	postgres, err := pgxpool.ParseConfig(connection.String())
	if err != nil {
		return Config{}, fmt.Errorf("configuración de PostgreSQL inválida")
	}
	brokers := strings.Split(os.Getenv("KAFKA_BROKERS"), ",")
	for index, broker := range brokers {
		brokers[index] = strings.TrimSpace(broker)
		if _, _, err := net.SplitHostPort(brokers[index]); err != nil {
			return Config{}, fmt.Errorf("KAFKA_BROKERS debe contener direcciones host:puerto")
		}
	}
	return Config{GRPCPort: grpcPort, Postgres: postgres, KafkaBrokers: brokers}, nil
}
