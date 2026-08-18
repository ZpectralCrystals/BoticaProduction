import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/database.js'
import { AppError, ValidationError, NotFoundError } from '../plugins/error-handler.js'

/**
 * Interfaces del Módulo Clínico
 */
export interface Paciente {
  id: number
  uuid: string
  codigo_historia: string
  tipo_documento_id: number | null
  numero_documento: string | null
  apellido_paterno: string
  apellido_materno: string | null
  nombres: string
  nombre_completo: string
  fecha_nacimiento: string | null
  edad: number | null
  sexo: string | null
  telefono: string | null
  celular: string | null
  email: string | null
  direccion: string | null
  grupo_sanguineo: string | null
  alergias: string | null
  condiciones_cronicas: string | null
  medicamentos_habituales: string | null
  contacto_emergencia_nombre: string | null
  contacto_emergencia_telefono: string | null
  estado: string
  created_at: string
}

export interface PacienteInput {
  tipo_documento_id?: number
  numero_documento?: string
  apellido_paterno: string
  apellido_materno?: string
  nombres: string
  fecha_nacimiento?: string
  sexo?: 'M' | 'F'
  telefono?: string
  celular?: string
  email?: string
  direccion?: string
  distrito?: string
  ciudad?: string
  grupo_sanguineo?: string
  alergias?: string
  condiciones_cronicas?: string
  medicamentos_habituales?: string
  contacto_emergencia_nombre?: string
  contacto_emergencia_telefono?: string
  contacto_emergencia_parentesco?: string
}

export interface HistoriaClinica {
  id: number
  uuid: string
  paciente_id: number
  fecha_atencion: string
  tipo_atencion: string
  motivo_consulta: string | null
  enfermedad_actual: string | null
  tiempo_enfermedad: string | null
  temperatura: number | null
  presion_arterial: string | null
  frecuencia_cardiaca: number | null
  frecuencia_respiratoria: number | null
  peso: number | null
  talla: number | null
  imc: number | null
  saturacion_o2: number | null
  examen_general: string | null
  diagnostico_principal: string | null
  diagnosticos_secundarios: string | null
  tratamiento: string | null
  indicaciones: string | null
  reposo_dias: number | null
  proxima_cita: string | null
  estado: string
  medico_id: string | null
  medico_nombre: string | null
}

export interface HistoriaClinicaInput {
  paciente_id: number
  tipo_atencion?: 'CONSULTA' | 'EMERGENCIA' | 'CONTROL'
  motivo_consulta?: string
  enfermedad_actual?: string
  tiempo_enfermedad?: string
  signos_vitales?: {
    temperatura?: number
    presion_arterial?: string
    frecuencia_cardiaca?: number
    frecuencia_respiratoria?: number
    peso?: number
    talla?: number
    saturacion_o2?: number
  }
  examen_general?: string
  examen_especifico?: string
  diagnostico_principal?: string
  diagnosticos_cie10?: Array<{
    codigo: string
    descripcion: string
    tipo?: 'PRESUNTIVO' | 'DEFINITIVO' | 'CONTROL'
  }>
  diagnosticos_secundarios?: string
  tratamiento?: string
  indicaciones?: string
  reposo_dias?: number
  proxima_cita?: string
}

export interface Receta {
  id: number
  uuid: string
  historia_id: number | null
  paciente_id: number
  codigo: string
  fecha_emision: string
  fecha_vencimiento: string | null
  estado: 'ACTIVA' | 'PARCIAL' | 'COMPLETADA' | 'VENCIDA' | 'ANULADA'
  total_items: number
  total_despachado: number
  observaciones: string | null
  indicaciones_generales: string | null
  medico_id: string
  medico_nombre: string | null
  medico_colegiatura: string | null
  medico_especialidad: string | null
  sucursal_id: number | null
  created_at: string
}

export interface RecetaDetalle {
  id: number
  receta_id: number
  producto_id: number
  cantidad_recetada: number
  cantidad_despachada: number
  unidad_medida: string | null
  dosis: string | null
  frecuencia: string | null
  duracion: string | null
  horario: string | null
  via_administracion: string | null
  indicaciones: string | null
  estado: 'PENDIENTE' | 'PARCIAL' | 'COMPLETADO' | 'NO_DISPONIBLE'
  venta_detalle_id: number | null
  producto?: {
    id: number
    codigo: string
    nombre_generico: string
    presentacion: string | null
    precio_venta: number | null
  }
}

export interface RecetaInput {
  historia_id?: number
  paciente_id: number
  fecha_vencimiento?: string
  indicaciones_generales?: string
  observaciones?: string
  medico_id: string
  medico_nombre: string
  medico_colegiatura?: string
  medico_especialidad?: string
  sucursal_id?: number
  medicamentos: Array<{
    producto_id: number
    cantidad: number
    unidad_medida?: string
    dosis?: string
    frecuencia?: string
    duracion?: string
    horario?: string
    via?: string
    indicaciones?: string
  }>
}

export interface RecetaParaPOS {
  receta_detalle_id: number
  producto_id: number
  producto_codigo: string
  producto_nombre: string
  presentacion: string | null
  cantidad_recetada: number
  cantidad_despachada: number
  cantidad_pendiente: number
  dosis: string | null
  frecuencia: string | null
  duracion: string | null
  via_administracion: string | null
  indicaciones: string | null
  stock_disponible: number
  precio_venta: number
  disponibilidad: 'DISPONIBLE' | 'PARCIAL' | 'SIN_STOCK'
  item_estado: string
}

export interface FichaPaciente {
  paciente_id: number
  codigo_historia: string
  nombre_completo: string
  edad: number | null
  sexo: string | null
  grupo_sanguineo: string | null
  alergias: string | null
  condiciones_cronicas: string | null
  medicamentos_habituales: string | null
  total_consultas: number
  ultima_consulta: string | null
  recetas_activas: number
  recetas_totales: number
}

/**
 * Servicio Clínico - Gestión de pacientes, historias y recetas
 */
export class ClinicalService {
  constructor(private supabase: SupabaseClient<Database>) {}

  // ==========================================
  // PACIENTES
  // ==========================================

  async buscarPacientes(busqueda: string, limit: number = 20): Promise<Paciente[]> {
    const { data, error } = await this.supabase.rpc('buscar_pacientes', {
      p_busqueda: busqueda,
    })

    if (error) {
      throw new AppError('Error al buscar pacientes: ' + error.message, 500)
    }

    // Obtener datos completos de los pacientes encontrados
    if (!data || data.length === 0) {
      return []
    }

    const pacienteIds = data.map((p: any) => p.paciente_id)
    const { data: pacientes, error: error2 } = await this.supabase
      .from('pacientes')
      .select('*')
      .in('id', pacienteIds)
      .order('nombre_completo')
      .limit(limit)

    if (error2) {
      throw new AppError('Error al obtener pacientes: ' + error2.message, 500)
    }

    return pacientes ?? []
  }

  async getPacienteById(id: number): Promise<Paciente> {
    const { data, error } = await this.supabase.from('pacientes').select('*').eq('id', id).single()

    if (error || !data) {
      throw new NotFoundError('Paciente no encontrado')
    }

    return data as Paciente
  }

  async getPacienteByDocumento(tipoDocumentoId: number, numeroDocumento: string): Promise<Paciente | null> {
    const { data, error } = await this.supabase
      .from('pacientes')
      .select('*')
      .eq('tipo_documento_id', tipoDocumentoId)
      .eq('numero_documento', numeroDocumento)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new AppError('Error al buscar paciente: ' + error.message, 500)
    }

    return data as Paciente | null
  }

  async crearPaciente(input: PacienteInput, usuarioId: string): Promise<Paciente> {
    // Validaciones
    if (!input.apellido_paterno || !input.nombres) {
      throw new ValidationError('Apellido paterno y nombres son requeridos')
    }

    // Generar código de historia
    const { data: seqData } = await this.supabase.rpc('get_next_historia_code')
    const codigoHistoria = seqData || `HCL-${Date.now().toString(36).toUpperCase()}`

    const { data, error } = await this.supabase
      .from('pacientes')
      .insert({
        codigo_historia: codigoHistoria,
        tipo_documento_id: input.tipo_documento_id,
        numero_documento: input.numero_documento,
        apellido_paterno: input.apellido_paterno,
        apellido_materno: input.apellido_materno,
        nombres: input.nombres,
        fecha_nacimiento: input.fecha_nacimiento,
        sexo: input.sexo,
        telefono: input.telefono,
        celular: input.celular,
        email: input.email,
        direccion: input.direccion,
        distrito: input.distrito,
        ciudad: input.ciudad,
        grupo_sanguineo: input.grupo_sanguineo,
        alergias: input.alergias,
        condiciones_cronicas: input.condiciones_cronicas,
        medicamentos_habituales: input.medicamentos_habituales,
        contacto_emergencia_nombre: input.contacto_emergencia_nombre,
        contacto_emergencia_telefono: input.contacto_emergencia_telefono,
        contacto_emergencia_parentesco: input.contacto_emergencia_parentesco,
        created_by: usuarioId,
      })
      .select()
      .single()

    if (error) {
      throw new AppError('Error al crear paciente: ' + error.message, 500)
    }

    return data as Paciente
  }

  async actualizarPaciente(id: number, input: Partial<PacienteInput>, usuarioId: string): Promise<Paciente> {
    const { data, error } = await this.supabase
      .from('pacientes')
      .update({
        ...input,
        updated_by: usuarioId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      throw new NotFoundError('Paciente no encontrado o error al actualizar')
    }

    return data as Paciente
  }

  async getFichaPaciente(pacienteId: number): Promise<FichaPaciente> {
    const { data, error } = await this.supabase.rpc('get_ficha_paciente', {
      p_paciente_id: pacienteId,
    })

    if (error || !data || data.length === 0) {
      throw new NotFoundError('Paciente no encontrado')
    }

    return data[0] as FichaPaciente
  }

  // ==========================================
  // HISTORIAS CLÍNICAS
  // ==========================================

  async getHistoriasPaciente(pacienteId: number, limit: number = 10): Promise<HistoriaClinica[]> {
    const { data, error } = await this.supabase
      .from('historias_clinicas')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('fecha_atencion', { ascending: false })
      .limit(limit)

    if (error) {
      throw new AppError('Error al obtener historias: ' + error.message, 500)
    }

    return data ?? []
  }

  async getHistoriaById(id: number): Promise<HistoriaClinica> {
    const { data, error } = await this.supabase
      .from('historias_clinicas')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      throw new NotFoundError('Historia clínica no encontrada')
    }

    return data as HistoriaClinica
  }

  async crearHistoriaClinica(input: HistoriaClinicaInput, usuarioId: string, usuarioNombre: string): Promise<HistoriaClinica> {
    // Validar paciente
    const { data: paciente, error: pacienteError } = await this.supabase
      .from('pacientes')
      .select('id')
      .eq('id', input.paciente_id)
      .single()

    if (pacienteError || !paciente) {
      throw new NotFoundError('Paciente no encontrado')
    }

    const { data, error } = await this.supabase
      .from('historias_clinicas')
      .insert({
        paciente_id: input.paciente_id,
        tipo_atencion: input.tipo_atencion || 'CONSULTA',
        motivo_consulta: input.motivo_consulta,
        enfermedad_actual: input.enfermedad_actual,
        tiempo_enfermedad: input.tiempo_enfermedad,
        temperatura: input.signos_vitales?.temperatura,
        presion_arterial: input.signos_vitales?.presion_arterial,
        frecuencia_cardiaca: input.signos_vitales?.frecuencia_cardiaca,
        frecuencia_respiratoria: input.signos_vitales?.frecuencia_respiratoria,
        peso: input.signos_vitales?.peso,
        talla: input.signos_vitales?.talla,
        saturacion_o2: input.signos_vitales?.saturacion_o2,
        examen_general: input.examen_general,
        examen_especifico: input.examen_especifico,
        diagnostico_principal: input.diagnostico_principal,
        diagnosticos_secundarios: input.diagnosticos_secundarios,
        tratamiento: input.tratamiento,
        indicaciones: input.indicaciones,
        reposo_dias: input.reposo_dias,
        proxima_cita: input.proxima_cita,
        medico_id: usuarioId,
        medico_nombre: usuarioNombre,
      })
      .select()
      .single()

    if (error) {
      throw new AppError('Error al crear historia clínica: ' + error.message, 500)
    }

    // Insertar diagnósticos CIE-10 si existen
    if (input.diagnosticos_cie10 && input.diagnosticos_cie10.length > 0) {
      const diagnosticos = input.diagnosticos_cie10.map((d, index) => ({
        historia_id: data.id,
        codigo_cie10: d.codigo,
        descripcion: d.descripcion,
        tipo: d.tipo || 'PRESUNTIVO',
        orden: index + 1,
      }))

      await this.supabase.from('historias_diagnosticos').insert(diagnosticos)
    }

    return data as HistoriaClinica
  }

  // ==========================================
  // RECETAS
  // ==========================================

  async buscarRecetasPaciente(pacienteId: number, incluirCompletadas: boolean = false): Promise<any[]> {
    const { data, error } = await this.supabase.rpc('buscar_recetas_paciente', {
      p_paciente_id: pacienteId,
      p_incluir_completadas: incluirCompletadas,
    })

    if (error) {
      throw new AppError('Error al buscar recetas: ' + error.message, 500)
    }

    return data ?? []
  }

  async getRecetaById(id: number): Promise<Receta> {
    const { data, error } = await this.supabase.from('recetas').select('*').eq('id', id).single()

    if (error || !data) {
      throw new NotFoundError('Receta no encontrada')
    }

    return data as Receta
  }

  async getRecetaByCodigo(codigo: string): Promise<Receta> {
    const { data, error } = await this.supabase.from('recetas').select('*').eq('codigo', codigo).single()

    if (error || !data) {
      throw new NotFoundError('Receta no encontrada')
    }

    return data as Receta
  }

  async getRecetaDetalle(recetaId: number): Promise<RecetaDetalle[]> {
    const { data, error } = await this.supabase
      .from('recetas_detalle')
      .select(`
        *,
        producto:producto_id (
          id,
          codigo,
          nombre_generico,
          presentacion,
          precio_venta
        )
      `)
      .eq('receta_id', recetaId)
      .order('id')

    if (error) {
      throw new AppError('Error al obtener detalle de receta: ' + error.message, 500)
    }

    return data ?? []
  }

  async getRecetaParaPOS(recetaId: number): Promise<RecetaParaPOS[]> {
    const { data, error } = await this.supabase.rpc('get_receta_para_pos', {
      p_receta_id: recetaId,
    })

    if (error) {
      throw new AppError('Error al obtener receta para POS: ' + error.message, 500)
    }

    return data ?? []
  }

  async verificarRecetaDisponible(codigoReceta: string): Promise<any> {
    const { data, error } = await this.supabase.rpc('verificar_receta_disponible', {
      p_receta_codigo: codigoReceta,
    })

    if (error || !data || data.length === 0) {
      throw new NotFoundError('Receta no encontrada')
    }

    return data[0]
  }

  async crearReceta(input: RecetaInput, usuarioId: string, usuarioNombre: string): Promise<{ receta: Receta; historia: HistoriaClinica | null }> {
    // Validaciones
    if (!input.paciente_id) {
      throw new ValidationError('El paciente es requerido')
    }

    if (!input.medicamentos || input.medicamentos.length === 0) {
      throw new ValidationError('Debe incluir al menos un medicamento')
    }

    // Verificar paciente
    const { data: paciente, error: pacienteError } = await this.supabase
      .from('pacientes')
      .select('id')
      .eq('id', input.paciente_id)
      .single()

    if (pacienteError || !paciente) {
      throw new NotFoundError('Paciente no encontrado')
    }

    // Generar código de receta
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const random = Math.floor(1000 + Math.random() * 9000)
    const codigoReceta = `REC-${date}-${random}`

    // Crear receta
    const { data: receta, error: recetaError } = await this.supabase
      .from('recetas')
      .insert({
        historia_id: input.historia_id,
        paciente_id: input.paciente_id,
        codigo: codigoReceta,
        fecha_emision: new Date().toISOString(),
        fecha_vencimiento: input.fecha_vencimiento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        estado: 'ACTIVA',
        total_items: input.medicamentos.length,
        indicaciones_generales: input.indicaciones_generales,
        observaciones: input.observaciones,
        medico_id: usuarioId,
        medico_nombre: input.medico_nombre || usuarioNombre,
        medico_colegiatura: input.medico_colegiatura,
        medico_especialidad: input.medico_especialidad,
        sucursal_id: input.sucursal_id,
      })
      .select()
      .single()

    if (recetaError || !receta) {
      throw new AppError('Error al crear receta: ' + recetaError?.message, 500)
    }

    // Crear detalle de receta
    const detalleReceta = input.medicamentos.map((med) => ({
      receta_id: receta.id,
      producto_id: med.producto_id,
      cantidad_recetada: med.cantidad,
      unidad_medida: med.unidad_medida,
      dosis: med.dosis,
      frecuencia: med.frecuencia,
      duracion: med.duracion,
      horario: med.horario,
      via_administracion: med.via,
      indicaciones: med.indicaciones,
      estado: 'PENDIENTE',
    }))

    const { error: detalleError } = await this.supabase.from('recetas_detalle').insert(detalleReceta)

    if (detalleError) {
      // Rollback: eliminar receta
      await this.supabase.from('recetas').delete().eq('id', receta.id)
      throw new AppError('Error al crear detalle de receta: ' + detalleError.message, 500)
    }

    return { receta: receta as Receta, historia: null }
  }

  async crearConsultaConReceta(
    input: HistoriaClinicaInput & { receta?: Omit<RecetaInput, 'paciente_id' | 'historia_id'> },
    usuarioId: string,
    usuarioNombre: string
  ): Promise<{ historia: HistoriaClinica; receta: Receta | null }> {
    const signosVitales = input.signos_vitales || {}

    const { data, error } = await this.supabase.rpc('crear_consulta_con_receta', {
      p_paciente_id: input.paciente_id,
      p_medico_id: usuarioId,
      p_medico_nombre: usuarioNombre,
      p_medico_colegiatura: input.receta?.medico_colegiatura || '',
      p_sucursal_id: input.receta?.sucursal_id,
      p_motivo_consulta: input.motivo_consulta,
      p_signos_vitales: {
        temperatura: signosVitales.temperatura,
        presion_arterial: signosVitales.presion_arterial,
        frecuencia_cardiaca: signosVitales.frecuencia_cardiaca,
        frecuencia_respiratoria: signosVitales.frecuencia_respiratoria,
        peso: signosVitales.peso,
        talla: signosVitales.talla,
        saturacion_o2: signosVitales.saturacion_o2,
      },
      p_diagnostico_principal: input.diagnostico_principal,
      p_diagnosticos_cie10: input.diagnosticos_cie10 || [],
      p_tratamiento: input.tratamiento,
      p_medicamentos: input.receta?.medicamentos || [],
      p_indicaciones_generales: input.receta?.indicaciones_generales,
    })

    if (error || !data || data.length === 0) {
      throw new AppError('Error al crear consulta con receta: ' + error?.message, 500)
    }

    const result = data[0]

    // Obtener objetos completos
    const historia = await this.getHistoriaById(result.historia_id)
    let receta = null
    if (result.receta_id) {
      receta = await this.getRecetaById(result.receta_id)
    }

    return { historia, receta }
  }

  // ==========================================
  // RECETAS PENDIENTES (Para POS)
  // ==========================================

  async getRecetasPendientes(sucursalId?: number): Promise<any[]> {
    let query = this.supabase.from('vista_recetas_pendientes').select('*')

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query.order('fecha_emision', { ascending: false })

    if (error) {
      throw new AppError('Error al obtener recetas pendientes: ' + error.message, 500)
    }

    return data ?? []
  }

  async getRecetasPendientesPorPaciente(pacienteId: number): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('vista_recetas_pendientes')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('fecha_emision', { ascending: false })

    if (error) {
      throw new AppError('Error al obtener recetas del paciente: ' + error.message, 500)
    }

    return data ?? []
  }
}
