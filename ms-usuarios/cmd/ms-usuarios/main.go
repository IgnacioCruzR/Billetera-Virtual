package main

import (
	"fmt"
	"os"

	"billetera.local/ms-usuarios/internal/config"
	"google.golang.org/grpc"
)

func main() {
	if err := checkConfiguration(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("Configuración de Usuarios válida")
}

func checkConfiguration() error {
	if _, err := config.Load(); err != nil {
		return err
	}
	server := grpc.NewServer()
	server.Stop()
	return nil
}
