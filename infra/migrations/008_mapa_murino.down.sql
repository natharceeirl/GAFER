-- Reversa de 008_mapa_murino
DROP TRIGGER IF EXISTS trg_proteger_mapa_visita ON mapa_visita_estaciones;
DROP FUNCTION IF EXISTS fn_proteger_mapa_visita();
DROP TABLE IF EXISTS mapa_visita_estaciones;
DROP TABLE IF EXISTS mapa_estaciones;
DROP TRIGGER IF EXISTS trg_limitar_planos_por_proyecto ON planos;
DROP FUNCTION IF EXISTS fn_limitar_planos_por_proyecto();
DROP TABLE IF EXISTS planos;
