import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { ClinicalService } from '../services/clinical.service.js'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'

/**
 * Schemas de validación
 */
const pacienteSchema = z.object({
  tipo_documento_id: z.number().optional(),
  numero_documento: z.string().optional(),
  apellido_paterno: z.string().min(2, 'Apellido paterno requerido'),
  apellido_materno: z.string().optional(),
  nombres: z.string().min(2, 'Nombres requeridos'),
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sexo: z.enum(['M', 'F']).optional(),
  telefono: z.string().optional(),
  celular: z.string().optional(),
  email: z.string().email().optional(),
  direccion: z.string().optional(),
  distrito: z.string().optional(),
  ciudad: z.string().optional(),
  grupo_sanguineo: z.string().optional(),
  alergias: z.string().optional(),
  condiciones_cronicas: z.string().optional(),
  medicamentos_habituales: z.string().optional(),
  contacto_emergencia_nombre: z.string().optional(),
  contacto_emergencia_telefono: z.string().optional(),
  contacto_emergencia_parentesco: z.string().optional(),
})

const historiaClinicaSchema = z.object({
  paciente_id: z.number().positive('Paciente requerido'),
  tipo_atencion: z.enum(['CONSULTA', 'EMERGENCIA', 'CONTROL']).default('CONSULTA'),
  motivo_consulta: z.string().optional(),
  enfermedad_actual: z.string().optional(),
  tiempo_enfermedad: z.string().optional(),
  signos_vitales: z
    .object({
      temperatura: z.number().optional(),
      presion_arterial: z.string().optional(),
      frecuencia_cardiaca: z.number().int().optional(),
      frecuencia_respiratoria: z.number().int().optional(),
      peso: z.number().optional(),
      talla: z.number().optional(),
      saturacion_o2: z.number().int().optional(),
    })
    .optional(),
  examen_general: z.string().optional(),
  examen_especifico: z.string().optional(),
  diagnostico_principal: z.string().optional(),
  diagnosticos_cie10: z
    .array(
      z.object({
        codigo: z.string(),
        descripcion: z.string(),
        tipo: z.enum(['PRESUNTIVO', 'DEFINITIVO', 'CONTROL']).optional(),
      })
    )
    .optional(),
  diagnosticos_secundarios: z.string().optional(),
  tratamiento: z.string().optional(),
  indicaciones: z.string().optional(),
  reposo_dias: z.number().int().optional(),
  proxima_cita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const medicamentoRecetaSchema = z.object({
  producto_id: z.number().positive(),
  cantidad: z.number().int().positive(),
  unidad_medida: z.string().optional(),
  dosis: z.string().optional(),
  frecuencia: z.string().optional(),
  duracion: z.string().optional(),
  horario: z.string().optional(),
  via: z.string().optional(),
  indicaciones: z.string().optional(),
})

const recetaSchema = z.object({
  historia_id: z.number().optional(),
  paciente_id: z.number().positive('Paciente requerido'),
  fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  indicaciones_generales: z.string().optional(),
  observaciones: z.string().optional(),
  medico_colegiatura: z.string().optional(),
  medico_especialidad: z.string().optional(),
  sucursal_id: z.number().optional(),
  medicamentos: z.array(medicamentoRecetaSchema).min(1, 'Al menos un medicamento requerido'),
})

const consultaConRecetaSchema = historiaClinicaSchema.extend({
  receta: z
    .object({
      fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      indicaciones_generales: z.string().optional(),
      observaciones: z.string().optional(),
      medico_colegiatura: z.string().optional(),
      medico_especialidad: z.string().optional(),
      sucursal_id: z.number().optional(),
      medicamentos: z.array(medicamentoRecetaSchema).min(1, 'Al menos un medicamento requerido'),
    })
    .optional(),
})

/**
 * Rutas del Módulo Clínico
 */
export default async function clinicalRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  const clinicalService = new ClinicalService(fastify.supabase)

  // ==========================================
  // PACIENTES
  // ==========================================

  // GET /clinical/pacientes/buscar?q=...
  fastify.get(
    '/pacientes/buscar',
    {
      preHandler: authenticate,
      schema: {
        description: 'Buscar pacientes por nombre, documento o código',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 2 },
            limit: { type: 'number', default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const { q, limit } = request.query as { q: string; limit?: number }
      const pacientes = await clinicalService.buscarPacientes(q, limit)
      return { success: true, data: pacientes }
    }
  )

  // GET /clinical/pacientes/:id
  fastify.get(
    '/pacientes/:id',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener datos de un paciente',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const paciente = await clinicalService.getPacienteById(parseInt(id))
      return { success: true, data: paciente }
    }
  )

  // GET /clinical/pacientes/:id/ficha
  fastify.get(
    '/pacientes/:id/ficha',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener ficha completa del paciente',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const ficha = await clinicalService.getFichaPaciente(parseInt(id))
      return { success: true, data: ficha }
    }
  )

  // POST /clinical/pacientes
  fastify.post(
    '/pacientes',
    {
      preHandler: authenticate,
      schema: {
        description: 'Crear nuevo paciente',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['apellido_paterno', 'nombres'],
          properties: {
            tipo_documento_id: { type: 'number' },
            numero_documento: { type: 'string' },
            apellido_paterno: { type: 'string' },
            apellido_materno: { type: 'string' },
            nombres: { type: 'string' },
            fecha_nacimiento: { type: 'string', format: 'date' },
            sexo: { type: 'string', enum: ['M', 'F'] },
            telefono: { type: 'string' },
            celular: { type: 'string' },
            email: { type: 'string', format: 'email' },
            grupo_sanguineo: { type: 'string' },
            alergias: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = pacienteSchema.parse(request.body)
      const paciente = await clinicalService.crearPaciente(body, request.user!.id)
      return { success: true, data: paciente, message: 'Paciente creado exitosamente' }
    }
  )

  // PUT /clinical/pacientes/:id
  fastify.put(
    '/pacientes/:id',
    {
      preHandler: authenticate,
      schema: {
        description: 'Actualizar paciente',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = pacienteSchema.partial().parse(request.body)
      const paciente = await clinicalService.actualizarPaciente(parseInt(id), body, request.user!.id)
      return { success: true, data: paciente, message: 'Paciente actualizado' }
    }
  )

  // ==========================================
  // HISTORIAS CLÍNICAS
  // ==========================================

  // GET /clinical/pacientes/:id/historias
  fastify.get(
    '/pacientes/:id/historias',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener historias clínicas de un paciente',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { limit } = request.query as { limit?: number }
      const historias = await clinicalService.getHistoriasPaciente(parseInt(id), limit)
      return { success: true, data: historias }
    }
  )

  // GET /clinical/historias/:id
  fastify.get(
    '/historias/:id',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener historia clínica por ID',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const historia = await clinicalService.getHistoriaById(parseInt(id))
      return { success: true, data: historia }
    }
  )

  // POST /clinical/historias
  fastify.post(
    '/historias',
    {
      preHandler: authenticate,
      schema: {
        description: 'Crear historia clínica',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['paciente_id'],
          properties: {
            paciente_id: { type: 'number' },
            tipo_atencion: { type: 'string', enum: ['CONSULTA', 'EMERGENCIA', 'CONTROL'] },
            motivo_consulta: { type: 'string' },
            signos_vitales: {
              type: 'object',
              properties: {
                temperatura: { type: 'number' },
                presion_arterial: { type: 'string' },
                frecuencia_cardiaca: { type: 'number' },
              },
            },
            diagnostico_principal: { type: 'string' },
            tratamiento: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = historiaClinicaSchema.parse(request.body)
      const historia = await clinicalService.crearHistoriaClinica(
        body,
        request.user!.id,
        request.user!.email || request.user!.user_metadata?.nombre || 'Médico'
      )
      return { success: true, data: historia, message: 'Historia clínica creada' }
    }
  )

  // ==========================================
  // RECETAS
  // ==========================================

  // GET /clinical/recetas/pendientes
  fastify.get(
    '/recetas/pendientes',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener recetas pendientes de despacho (para POS)',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            sucursal_id: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sucursal_id } = request.query as { sucursal_id?: string }
      const recetas = await clinicalService.getRecetasPendientes(
        sucursal_id ? parseInt(sucursal_id) : undefined
      )
      return { success: true, data: recetas, count: recetas.length }
    }
  )

  // GET /clinical/recetas/verificar?codigo=...
  fastify.get(
    '/recetas/verificar',
    {
      preHandler: authenticate,
      schema: {
        description: 'Verificar disponibilidad de receta por código (para POS)',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['codigo'],
          properties: {
            codigo: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { codigo } = request.query as { codigo: string }
      const verificacion = await clinicalService.verificarRecetaDisponible(codigo)
      return { success: true, data: verificacion }
    }
  )

  // GET /clinical/recetas/:id
  fastify.get(
    '/recetas/:id',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener receta por ID',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const receta = await clinicalService.getRecetaById(parseInt(id))
      const detalle = await clinicalService.getRecetaDetalle(parseInt(id))
      return { success: true, data: { ...receta, detalle } }
    }
  )

  // GET /clinical/recetas/:id/pos
  fastify.get(
    '/recetas/:id/pos',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener receta formateada para el POS con info de stock',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const receta = await clinicalService.getRecetaById(parseInt(id))
      const itemsPOS = await clinicalService.getRecetaParaPOS(parseInt(id))

      return {
        success: true,
        data: {
          receta: {
            id: receta.id,
            codigo: receta.codigo,
            estado: receta.estado,
            fecha_emision: receta.fecha_emision,
            medico_nombre: receta.medico_nombre,
          },
          paciente_id: receta.paciente_id,
          items: itemsPOS,
          puede_despacharse: itemsPOS.some((item) => item.disponibilidad !== 'SIN_STOCK'),
        },
      }
    }
  )

  // GET /clinical/pacientes/:id/recetas
  fastify.get(
    '/pacientes/:id/recetas',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener recetas de un paciente',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            incluir_completadas: { type: 'boolean', default: false },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { incluir_completadas } = request.query as { incluir_completadas?: string }
      const recetas = await clinicalService.buscarRecetasPaciente(
        parseInt(id),
        incluir_completadas === 'true'
      )
      return { success: true, data: recetas }
    }
  )

  // POST /clinical/recetas
  fastify.post(
    '/recetas',
    {
      preHandler: authenticate,
      schema: {
        description: 'Crear receta médica',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['paciente_id', 'medicamentos'],
          properties: {
            paciente_id: { type: 'number' },
            historia_id: { type: 'number' },
            fecha_vencimiento: { type: 'string', format: 'date' },
            indicaciones_generales: { type: 'string' },
            observaciones: { type: 'string' },
            medico_colegiatura: { type: 'string' },
            medico_especialidad: { type: 'string' },
            sucursal_id: { type: 'number' },
            medicamentos: {
              type: 'array',
              items: {
                type: 'object',
                required: ['producto_id', 'cantidad'],
                properties: {
                  producto_id: { type: 'number' },
                  cantidad: { type: 'number' },
                  dosis: { type: 'string' },
                  frecuencia: { type: 'string' },
                  duracion: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = recetaSchema.parse(request.body)
      const usuarioNombre = request.user!.email || request.user!.user_metadata?.nombre || 'Médico'

      const { receta } = await clinicalService.crearReceta(body, request.user!.id, usuarioNombre)
      return { success: true, data: receta, message: 'Receta creada exitosamente' }
    }
  )

  // POST /clinical/consultas (Consulta + Receta en uno)
  fastify.post(
    '/consultas',
    {
      preHandler: authenticate,
      schema: {
        description: 'Crear consulta médica con receta (flujo completo)',
        tags: ['clinical'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['paciente_id'],
          properties: {
            paciente_id: { type: 'number' },
            tipo_atencion: { type: 'string' },
            motivo_consulta: { type: 'string' },
            diagnostico_principal: { type: 'string' },
            tratamiento: { type: 'string' },
            signos_vitales: {
              type: 'object',
              properties: {
                temperatura: { type: 'number' },
                presion_arterial: { type: 'string' },
                frecuencia_cardiaca: { type: 'number' },
                peso: { type: 'number' },
                talla: { type: 'number' },
              },
            },
            receta: {
              type: 'object',
              properties: {
                indicaciones_generales: { type: 'string' },
                observaciones: { type: 'string' },
                medico_colegiatura: { type: 'string' },
                sucursal_id: { type: 'number' },
                medicamentos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['producto_id', 'cantidad'],
                    properties: {
                      producto_id: { type: 'number' },
                      cantidad: { type: 'number' },
                      dosis: { type: 'string' },
                      frecuencia: { type: 'string' },
                      duracion: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = consultaConRecetaSchema.parse(request.body)
      const usuarioNombre = request.user!.email || request.user!.user_metadata?.nombre || 'Médico'

      const { historia, receta } = await clinicalService.crearConsultaConReceta(
        body,
        request.user!.id,
        usuarioNombre
      )

      return {
        success: true,
        data: { historia, receta },
        message: receta ? 'Consulta y receta creadas exitosamente' : 'Consulta creada (sin receta)',
      }
    }
  )
}
