# Reporte de pruebas de estrés y concurrencia — T3.2

Generado: 2026-09-23T22:42:53.283Z

| Prueba | Resultado | Detalle |
|---|---|---|
| Carga alta sin colisiones (100 peticiones concurrentes, estaciones distintas) | OK | 100/100 respondieron 201, 100/100 quedaron guardadas en la auditoría |
| Idempotencia bajo carga (mismo operationId, 20 repeticiones concurrentes) | FALLO | 19/20 repeticiones duplicaron el registro en la auditoría (ver BUG-08 en Issues_QA_Fase1.md). |
| Colisión bajo carga real (misma estación, 20 repeticiones concurrentes) | FALLO | 1/20 colisiones no se detectaron cuando las dos peticiones llegaron realmente al mismo tiempo (ver BUG-08 en Issues_QA_Fase1.md). |

## Tiempos de respuesta

- **Carga alta sin colisiones (100 peticiones concurrentes, estaciones distintas)**: {"peticiones":100,"duracionMs":554,"porSegundo":181}
- **Idempotencia bajo carga (mismo operationId, 20 repeticiones concurrentes)**: {"repeticiones":20,"duracionMs":192}
- **Colisión bajo carga real (misma estación, 20 repeticiones concurrentes)**: {"repeticiones":20,"duracionMs":225}
