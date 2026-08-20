package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/WolcenOn/Gestor-Almentacion/backend/internal/auth"
)

func main() {
	reader := bufio.NewReader(os.Stdin)

	fmt.Print("Nueva contraseña (mínimo 8 caracteres): ")
	password, err := reader.ReadString('\n')
	if err != nil {
		fmt.Fprintln(os.Stderr, "No se pudo leer la contraseña:", err)
		os.Exit(1)
	}
	password = strings.TrimRight(password, "\r\n")

	fmt.Print("Repite la contraseña: ")
	confirmation, err := reader.ReadString('\n')
	if err != nil {
		fmt.Fprintln(os.Stderr, "No se pudo leer la confirmación:", err)
		os.Exit(1)
	}
	confirmation = strings.TrimRight(confirmation, "\r\n")

	if password != confirmation {
		fmt.Fprintln(os.Stderr, "Las contraseñas no coinciden.")
		os.Exit(1)
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		fmt.Fprintln(os.Stderr, "No se pudo generar el hash:", err)
		os.Exit(1)
	}

	fmt.Println("\nHash generado:")
	fmt.Println(hash)
}
