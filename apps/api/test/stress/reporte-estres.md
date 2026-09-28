# Reporte de pruebas de estrés y concurrencia — T3.2

Generado: 2026-09-28T23:19:38.006Z

| Prueba | Resultado | Detalle |
|---|---|---|
| Carga alta sin colisiones (100 peticiones concurrentes, estaciones distintas) | OK | 100/100 respondieron 201, 100/100 quedaron guardadas en la auditoría |
| Idempotencia bajo carga (mismo operationId, 20 repeticiones concurrentes) | OK | Ninguna repetición duplicó el registro. |
| Colisión bajo carga real (misma estación, 20 repeticiones concurrentes) | OK | Todas las colisiones se detectaron. |

## Tiempos de respuesta

- **Carga alta sin colisiones (100 peticiones concurrentes, estaciones distintas)**: {"peticiones":100,"duracionMs":1264,"porSegundo":79}
- **Idempotencia bajo carga (mismo operationId, 20 repeticiones concurrentes)**: {"repeticiones":20,"duracionMs":469}
- **Colisión bajo carga real (misma estación, 20 repeticiones concurrentes)**: {"repeticiones":20,"duracionMs":626}
