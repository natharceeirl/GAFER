/**
 * validar-datos-demo.ts
 * Valida el conjunto de datos de ejemplo con los esquemas de @gafer/contracts y comprueba que sus referencias
 * y claves naturales sean coherentes, antes de escribir nada en la base.
 *
 * Historial de versiones
 *   v1.0  2026-10-08  ihuayhuam  Creación del archivo (GAF-94).
 */
import { randomUUID } from 'crypto';
import { z, ZodError, ZodTypeAny } from 'zod';
import {
  ClienteRegistroSchema,
  CrearUsuarioSchema,
  DirectorTecnicoSchema,
  EquipoRegistroSchema,
  InsumoRegistroSchema,
  PersonalRegistroSchema,
  ProyectoRegistroSchema,
  ServicioContratadoRegistroSchema,
} from '@gafer/contracts';
import { DatosDemo } from './datos-demo';

const RELLENO_PARA_VALIDAR = 'x'.repeat(16);
const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Dígito verificador del RUC peruano (módulo 11 sobre los 10 primeros dígitos). */
export function rucTieneDigitoVerificador(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false;
  const suma = PESOS_RUC.reduce((total, peso, i) => total + peso * Number(ruc[i]), 0);
  const resto = 11 - (suma % 11);
  const digito = resto === 10 ? 0 : resto === 11 ? 1 : resto;
  return digito === Number(ruc[10]);
}

function describir(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || 'datos'}: ${i.message}`).join('; ');
}

function repetidos<T>(valores: T[]): T[] {
  return valores.filter((valor, i) => valores.indexOf(valor) !== i);
}

/**
 * Devuelve la lista de problemas (vacía si todo es válido). Cada registro se prueba con el esquema que usa la API
 * para el alta; los identificadores que la base genera se reemplazan por UUID de relleno.
 */
export function validarDatosDemo(datos: DatosDemo): string[] {
  const problemas: string[] = [];

  const probar = (etiqueta: string, esquema: ZodTypeAny, valor: unknown): void => {
    const resultado = esquema.safeParse(valor);
    if (!resultado.success) problemas.push(`${etiqueta}: ${describir(resultado.error)}`);
  };

  const clienteId = randomUUID();
  datos.clientes.forEach((cliente, i) => probar(`clientes[${i}] (${cliente.codigoCorto})`, ClienteRegistroSchema, cliente));
  datos.clientes.forEach((cliente, i) => {
    if (!rucTieneDigitoVerificador(cliente.ruc)) problemas.push(`clientes[${i}] (${cliente.codigoCorto}): ruc sin dígito verificador válido`);
  });

  const codigosCliente = new Set(datos.clientes.map((c) => c.codigoCorto));
  datos.sedes.forEach(({ clienteCodigo, ...sede }, i) => {
    probar(`sedes[${i}] (${sede.nombre})`, ProyectoRegistroSchema, { ...sede, clienteId });
    if (!codigosCliente.has(clienteCodigo)) problemas.push(`sedes[${i}] (${sede.nombre}): el cliente ${clienteCodigo} no existe en el conjunto`);
  });

  datos.insumos.forEach((insumo, i) => probar(`insumos[${i}] (${insumo.registroDigesa})`, InsumoRegistroSchema, insumo));
  datos.equipos.forEach((equipo, i) => probar(`equipos[${i}] (${equipo.codigoInterno})`, EquipoRegistroSchema, equipo));

  const registros = new Set(datos.insumos.map((i) => i.registroDigesa));
  const codigosEquipo = new Set(datos.equipos.map((e) => e.codigoInterno));
  const sedes = new Set(datos.sedes.map((s) => `${s.clienteCodigo}/${s.nombre}`));
  const idsInsumo = new Map([...registros].map((registro) => [registro, randomUUID()]));
  const idsEquipo = new Map([...codigosEquipo].map((codigo) => [codigo, randomUUID()]));

  datos.servicios.forEach((servicio, i) => {
    const etiqueta = `servicios[${i}] (${servicio.clienteCodigo}/${servicio.sede}/${servicio.tipoServicio})`;
    probar(etiqueta, ServicioContratadoRegistroSchema, {
      proyectoId: randomUUID(),
      tipoServicio: servicio.tipoServicio,
      frecuencia: servicio.frecuencia,
      areaTotalM2: servicio.areaTotalM2,
      areaTratarM2: servicio.areaTratarM2,
      insumosAutorizados: servicio.insumos.map((r) => idsInsumo.get(r) ?? r),
      equiposAutorizados: servicio.equipos.map((c) => idsEquipo.get(c) ?? c),
      dosisReferencial: servicio.dosisReferencial,
      requiereCertificado: servicio.requiereCertificado,
      vigenciaDias: servicio.vigenciaDias,
    });
    if (!sedes.has(`${servicio.clienteCodigo}/${servicio.sede}`)) problemas.push(`${etiqueta}: la sede no existe en el conjunto`);
    for (const registro of servicio.insumos) {
      if (!registros.has(registro)) problemas.push(`${etiqueta}: el insumo ${registro} no existe en el conjunto`);
    }
    for (const codigo of servicio.equipos) {
      if (!codigosEquipo.has(codigo)) problemas.push(`${etiqueta}: el equipo ${codigo} no existe en el conjunto`);
    }
    for (const registro of Object.keys(servicio.dosisReferencial)) {
      if (!servicio.insumos.includes(registro)) problemas.push(`${etiqueta}: dosis para ${registro}, que no es un insumo del servicio`);
    }
  });

  datos.personal.forEach((persona, i) => {
    const etiqueta = `personal[${i}] (${persona.usuario})`;
    const { usuario, ...registro } = persona;
    probar(etiqueta, PersonalRegistroSchema, persona);
    // Relleno de longitud válida solo para comprobar el resto de campos de CrearUsuarioSchema; no es una clave.
    probar(etiqueta, CrearUsuarioSchema, { ...registro, usuario, clave: RELLENO_PARA_VALIDAR });
  });

  probar('directorTecnico', DirectorTecnicoSchema, datos.directorTecnico);
  for (const [catalogo, items] of Object.entries(datos.catalogos)) {
    probar(`catalogos.${catalogo}`, z.array(z.string().min(1)), items);
    for (const item of repetidos(items ?? [])) problemas.push(`catalogos.${catalogo}: texto repetido "${item}"`);
  }

  for (const ruc of repetidos(datos.clientes.map((c) => c.ruc))) problemas.push(`RUC repetido: ${ruc}`);
  for (const codigo of repetidos(datos.clientes.map((c) => c.codigoCorto))) problemas.push(`Código corto repetido: ${codigo}`);
  for (const sede of repetidos(datos.sedes.map((s) => `${s.clienteCodigo}/${s.nombre}`))) problemas.push(`Sede repetida: ${sede}`);
  for (const servicio of repetidos(datos.servicios.map((s) => `${s.clienteCodigo}/${s.sede}/${s.tipoServicio}`))) {
    problemas.push(`Servicio repetido (misma sede y tipo): ${servicio}`);
  }
  for (const registro of repetidos(datos.insumos.map((i) => i.registroDigesa))) problemas.push(`Registro DIGESA repetido: ${registro}`);
  for (const codigo of repetidos(datos.equipos.map((e) => e.codigoInterno))) problemas.push(`Código de equipo repetido: ${codigo}`);
  for (const dni of repetidos(datos.personal.map((p) => p.dni))) problemas.push(`DNI repetido: ${dni}`);
  for (const usuario of repetidos(datos.personal.map((p) => p.usuario.toUpperCase()))) problemas.push(`Usuario repetido: ${usuario}`);

  return problemas;
}

/** Lanza un error con todos los problemas si el conjunto de datos no es válido. */
export function asegurarDatosDemoValidos(datos: DatosDemo): void {
  const problemas = validarDatosDemo(datos);
  if (problemas.length > 0) {
    throw new Error(`Los datos de ejemplo no cumplen los contratos:\n- ${problemas.join('\n- ')}`);
  }
}
