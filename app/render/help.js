export function renderHelp() {
  return `
    <article class="card">
      <h2>Ayuda rápida</h2>
      <div class="grid cols-2" style="margin-top:1rem">
        ${[
          ["1. Añadir ingredientes", "Crea alimentos lógicos con stock, unidad, familia y caducidad."],
          ["2. Asociar códigos", "Desde la compra puedes escanear o escribir un código y asociarlo al ingrediente."],
          ["3. Crear platos", "Cada plato contiene una receta con ingredientes y cantidades."],
          ["4. Planificar semana", "Añade platos al cuadrante semanal por día y tipo de comida."],
          ["5. Generar compra", "La lista se calcula restando stock y compras ya realizadas."],
          ["6. Comprar", "Usa Añadir manual o Escanear en cada ingrediente; admite compra parcial."],
          ["7. Imprimir", "Compra y semana tienen vistas de impresión independientes y compactas."],
          ["8. Exportar/importar", "Guarda una copia completa o restaura un JSON validado."],
          ["9. Packs", "Los packs remotos están bloqueados a WolcenOn/GestorMenuSemanal/packs."],
          ["10. Seguridad", "No se ejecuta código importado y se escapan los datos del usuario."]
        ].map(([title, text]) => `<div class="item"><strong>${title}</strong><p class="muted">${text}</p></div>`).join("")}
      </div>
    </article>`;
}
