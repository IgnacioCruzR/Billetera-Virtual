# Configuración de Billetera Virtual

Abre **Configuración** desde el sidebar o el botón de perfil. Las secciones editables indican si hay cambios pendientes, guardan por separado y permiten cancelar. Restaurar valores modifica el borrador de la sección. Cambiar de sección o salir con cambios pendientes requiere confirmar el descarte.

| Sección | Controles de la demo |
| --- | --- |
| Perfil y región | Nombre visible e iniciales, correo de muestra de solo lectura, zona horaria, formato de importes y fechas y período del dashboard. Idioma español, variante es-CL y moneda CLP. |
| Preferencias financieras | Umbral inicial de nuevos presupuestos, horizonte inicial de proyección, reserva mínima deseada y período inicial de Salud financiera y análisis compatibles. |
| Categorías | Alta, edición, archivado, reactivación y eliminación sin referencias. Los formularios nuevos usan categorías activas. Historiales, filtros y presupuestos existentes conservan las archivadas. |
| Gastos hormiga | Detección, monto máximo, frecuencia, exclusiones y vista. Los mismos valores se usan en el módulo y el dashboard. Las marcas manuales se conservan. |
| Salud financiera | Pilares y pesos fijos, versión v2-demo y referencias vigentes de 20 %, 15 % y 30 días. La aprobación y el versionado de parámetros editables quedan pendientes. |
| Notificaciones | Control general, reglas individuales de avisos locales y recordatorios de 1, 3 o 7 días para cobros y pagos. Los avisos informativos de Gastos hormiga y los resúmenes periódicos aparecen como pendientes. |
| Apariencia | Densidad, tamaño de texto, movimiento reducido, gráficos del dashboard y sidebar compacto en escritorio. |
| Privacidad | Ocultar importes de la sesión y elegir visibilidad inicial. La visualización se distingue del acceso a datos y del procesamiento externo. |
| Asistente IA | Activar el asistente, conceder o revocar autorización, observar la espera y borrar informes temporales. |
| Seguridad | Fecha de sesión, formulario de contraseña de prueba y cierre local con confirmación. |
| Exportación y datos | Vista previa y descarga CSV del conjunto elegido. Información sobre la futura eliminación de cuenta. |

La reserva deseada es una referencia para evaluar el margen. Cobros y pagos muestra por separado las reservas efectivas y el mínimo libre deseado. El simulador de compra preselecciona el objetivo libre y trabaja con el saldo después de reservas. El umbral predeterminado no cambia límites particulares existentes.

## Categorías

El nombre se compara por tipo entre categorías activas. Se recortan y colapsan espacios y, para la comparación, se ignoran mayúsculas y marcas diacríticas mediante normalización NFKD. Se conserva la escritura visible del usuario. El tipo de una categoría se fija al crearla. Reactivar comprueba que el nombre siga disponible.

El archivado conserva movimientos y presupuestos y se bloquea mientras haya compromisos pendientes asociados, conforme a RN-04. La eliminación requiere confirmación y ausencia de referencias actuales o de uso registrado en el historial local. Renombrar cambia la etiqueta compartida y conserva los IDs y los importes. [Reglas de negocio](BUSINESS_RULES.md)

## Exportación y sesión

El CSV exporta un conjunto por descarga. Movimientos y operaciones de reserva usan fecha efectiva, compromisos usan vencimiento, presupuestos usan meses que intersectan el rango, y las filas de metas usan fecha de creación. Cuentas y categorías exportan el estado actual. La vista previa indica alcance y cantidad de filas. El archivo incluye importes, aun con privacidad activa, después de confirmarlo en la vista previa.

El nombre, región y preferencias financieras se mantienen en la sesión. Solo las opciones visuales se guardan en el dispositivo. Revocar IA bloquea nuevas solicitudes y descarta la espera; borrar informes es una acción separada. Al cerrar la sesión local, se desmonta la aplicación y se descartan registros, preferencias de sesión, reglas y resultados temporales. Reingresar inicia una demo nueva.
