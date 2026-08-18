--
-- PostgreSQL database dump
--

\restrict xpRImPZe6QObPzTtipsSQmcPZLKHI1prvaTwKaWlINlGbJqcQqAGfmV7JVHfuD5

-- Dumped from database version 15.17 (Homebrew)
-- Dumped by pg_dump version 15.17 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: fn_aplicar_pago_cxp(integer, numeric, character varying, integer, character varying, text, integer, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_aplicar_pago_cxp(p_cxp_id integer, p_monto numeric, p_metodo_pago character varying, p_caja_movimiento_id integer, p_documento character varying, p_notas text, p_usuario_id integer, p_usuario_nombre character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_cxp_total NUMERIC(10, 2);
  v_cxp_pagado NUMERIC(10, 2);
  v_pago_id INTEGER;
  v_nuevo_pagado NUMERIC(10, 2);
  v_estado VARCHAR(15);
BEGIN
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a 0';
  END IF;

  SELECT nmonto_total, nmonto_pagado
    INTO v_cxp_total, v_cxp_pagado
  FROM bot_cuentas_por_pagar
  WHERE nid = p_cxp_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta por pagar % no encontrada', p_cxp_id;
  END IF;

  v_nuevo_pagado := v_cxp_pagado + p_monto;
  IF v_nuevo_pagado > v_cxp_total THEN
    RAISE EXCEPTION 'El pago % excede el saldo (total=%, pagado_actual=%)', p_monto, v_cxp_total, v_cxp_pagado;
  END IF;

  INSERT INTO bot_pagos_compras
    (ncxp_id, ncaja_movimiento_id, nmonto, cmetodo_pago, cdocumento, cnotas, nusuario_id, cusuario)
  VALUES
    (p_cxp_id, p_caja_movimiento_id, p_monto, p_metodo_pago, p_documento, p_notas, p_usuario_id, p_usuario_nombre)
  RETURNING nid INTO v_pago_id;

  v_estado := CASE
    WHEN v_nuevo_pagado >= v_cxp_total THEN 'PAGADA'
    WHEN v_nuevo_pagado > 0 THEN 'PARCIAL'
    ELSE 'PENDIENTE'
  END;

  UPDATE bot_cuentas_por_pagar
    SET nmonto_pagado = v_nuevo_pagado,
        cestado = v_estado
  WHERE nid = p_cxp_id;

  RETURN v_pago_id;
END;
$$;


--
-- Name: fn_bot_cxp_tmodifi(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_bot_cxp_tmodifi() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.tmodifi = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: fn_bot_lotes_set_tmodifi(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_bot_lotes_set_tmodifi() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.tmodifi = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: fn_bot_producto_precios_hist(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_bot_producto_precios_hist() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bot_producto_precios_hist
      (nproducto_id, cnombre, nprecio_anterior, nprecio_nuevo, caccion, nusuario_id, cusuario)
    VALUES
      (NEW.nproducto_id, NEW.cnombre, NULL, NEW.nprecio, 'INSERT', NEW.nusuario_id, NEW.cusuario);
  ELSIF TG_OP = 'UPDATE' AND (OLD.nprecio IS DISTINCT FROM NEW.nprecio OR OLD.lactivo IS DISTINCT FROM NEW.lactivo) THEN
    INSERT INTO bot_producto_precios_hist
      (nproducto_id, cnombre, nprecio_anterior, nprecio_nuevo, caccion, nusuario_id, cusuario)
    VALUES
      (NEW.nproducto_id, NEW.cnombre, OLD.nprecio, NEW.nprecio,
       CASE WHEN OLD.lactivo <> NEW.lactivo THEN 'TOGGLE_ACTIVO' ELSE 'UPDATE' END,
       NEW.nusuario_id, NEW.cusuario);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: fn_bot_producto_precios_tmodifi(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_bot_producto_precios_tmodifi() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.tmodifi = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: fn_sync_producto_precios_legacy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_producto_precios_legacy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_slot VARCHAR(20);
  v_precio NUMERIC(10, 2);
  v_activo BOOLEAN;
  v_producto_id INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_slot := OLD.cnombre;
    v_producto_id := OLD.nproducto_id;
    v_precio := NULL;
    v_activo := FALSE;
  ELSE
    v_slot := NEW.cnombre;
    v_producto_id := NEW.nproducto_id;
    v_precio := CASE WHEN NEW.lactivo THEN NEW.nprecio ELSE NULL END;
    v_activo := NEW.lactivo;
  END IF;

  IF v_slot = 'PRECIO_1' THEN
    UPDATE bot_productos
      SET npreventa = COALESCE(v_precio, 0),
          tmodifi = NOW()
      WHERE nid = v_producto_id;
  ELSIF v_slot = 'PRECIO_2' THEN
    UPDATE bot_productos
      SET npreventa_2 = v_precio,
          tmodifi = NOW()
      WHERE nid = v_producto_id;
  ELSIF v_slot = 'PRECIO_3' THEN
    UPDATE bot_productos
      SET npreventa_3 = v_precio,
          tmodifi = NOW()
      WHERE nid = v_producto_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bot_almacenes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_almacenes (
    nid integer NOT NULL,
    nlocal_id integer NOT NULL,
    cnombre character varying(120) NOT NULL,
    ccodigo character varying(30) NOT NULL,
    ctipo_almacen character varying(30) DEFAULT 'DISPONIBLE'::character varying NOT NULL,
    bpermite_venta boolean DEFAULT false NOT NULL,
    bpermite_consumo_clinico boolean DEFAULT false NOT NULL,
    brequiere_revision boolean DEFAULT false NOT NULL,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tmodifi timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_almacen_estado CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'I'::bpchar]))),
    CONSTRAINT chk_almacen_tipo CHECK (((ctipo_almacen)::text = ANY ((ARRAY['DISPONIBLE'::character varying, 'CUARENTENA'::character varying, 'DEVOLUCION_CLIENTE'::character varying, 'DEVOLUCION_PROVEEDOR'::character varying, 'BAJA'::character varying, 'PROCEDIMIENTOS'::character varying, 'CONTROL_ESPECIAL'::character varying])::text[])))
);


--
-- Name: bot_almacenes_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_almacenes_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_almacenes_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_almacenes_nid_seq OWNED BY public.bot_almacenes.nid;


--
-- Name: bot_alquileres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_alquileres (
    nid integer NOT NULL,
    cconcepto character varying(200) NOT NULL,
    carrendatario character varying(200),
    cdni character varying(11),
    ctelefono character varying(20),
    nperiodo_monto numeric(12,2) DEFAULT 0,
    cperiodo character varying(20) DEFAULT 'Mensual'::character varying,
    finicio date,
    ffin date,
    cnotas text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    CONSTRAINT bot_alquileres_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'F'::bpchar, 'V'::bpchar]))),
    CONSTRAINT bot_alquileres_cperiodo_check CHECK (((cperiodo)::text = ANY ((ARRAY['Diario'::character varying, 'Semanal'::character varying, 'Mensual'::character varying])::text[])))
);


--
-- Name: bot_alquileres_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_alquileres_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_alquileres_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_alquileres_nid_seq OWNED BY public.bot_alquileres.nid;


--
-- Name: bot_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_auditoria (
    nid integer NOT NULL,
    nusuario_id integer,
    cusuario character varying(200),
    caccion character varying(50) NOT NULL,
    ctabla character varying(50),
    nregistro_id integer,
    cdetalle text,
    cip character varying(50),
    tcreado timestamp without time zone DEFAULT now()
);


--
-- Name: bot_auditoria_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_auditoria_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_auditoria_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_auditoria_nid_seq OWNED BY public.bot_auditoria.nid;


--
-- Name: bot_caja; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_caja (
    nid integer NOT NULL,
    ccaja character varying(50) DEFAULT 'Caja principal'::character varying NOT NULL,
    napertura numeric(12,2) DEFAULT 0,
    ncierre numeric(12,2),
    nusuario_id integer,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tapertura timestamp without time zone DEFAULT now(),
    tcierre timestamp without time zone,
    nventas_total numeric(10,2) DEFAULT 0 NOT NULL,
    ningresos_total numeric(10,2) DEFAULT 0 NOT NULL,
    negresos_total numeric(10,2) DEFAULT 0 NOT NULL,
    npagos_factura_total numeric(10,2) DEFAULT 0 NOT NULL,
    ngastos_total numeric(10,2) DEFAULT 0 NOT NULL,
    nsaldo_esperado numeric(10,2) DEFAULT 0 NOT NULL,
    ndiferencia numeric(10,2) DEFAULT 0 NOT NULL,
    ncerrado_por_id integer,
    ccerrado_por character varying(120),
    CONSTRAINT bot_caja_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'C'::bpchar])))
);


--
-- Name: bot_caja_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_caja_movimientos (
    nid integer NOT NULL,
    ncaja_id integer NOT NULL,
    ctipo character varying(20) NOT NULL,
    nmonto numeric(10,2) NOT NULL,
    cmetodo_pago character varying(20) DEFAULT 'EFECTIVO'::character varying NOT NULL,
    cref_tabla character varying(50),
    nref_id integer,
    cdescripcion character varying(255),
    nusuario_id integer,
    cusuario character varying(100),
    cestado character varying(1) DEFAULT 'A'::character varying NOT NULL,
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_bot_caja_mov_metodo CHECK (((cmetodo_pago)::text = ANY ((ARRAY['EFECTIVO'::character varying, 'TARJETA'::character varying, 'TRANSFERENCIA'::character varying, 'YAPE'::character varying, 'PLIN'::character varying, 'OTRO'::character varying])::text[]))),
    CONSTRAINT chk_bot_caja_mov_monto_pos CHECK ((nmonto > (0)::numeric)),
    CONSTRAINT chk_bot_caja_mov_tipo CHECK (((ctipo)::text = ANY ((ARRAY['INGRESO'::character varying, 'EGRESO'::character varying, 'PAGO_FACTURA'::character varying, 'GASTO'::character varying, 'VENTA'::character varying, 'DEVOLUCION'::character varying])::text[])))
);


--
-- Name: TABLE bot_caja_movimientos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bot_caja_movimientos IS 'Movimientos detallados de caja (egresos, pagos, gastos). Las ventas se reflejan en bot_ventas y se proyectan aquí opcionalmente.';


--
-- Name: bot_caja_movimientos_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_caja_movimientos_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_caja_movimientos_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_caja_movimientos_nid_seq OWNED BY public.bot_caja_movimientos.nid;


--
-- Name: bot_caja_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_caja_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_caja_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_caja_nid_seq OWNED BY public.bot_caja.nid;


--
-- Name: bot_categorias_producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_categorias_producto (
    nid integer NOT NULL,
    nfamilia_id integer,
    cnombre character varying(100) NOT NULL,
    cdescripcion text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    tmodifi timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE bot_categorias_producto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bot_categorias_producto IS 'Catálogo de categorías comerciales de productos; puede estar asociada a una familia.';


--
-- Name: bot_categorias_producto_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_categorias_producto_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_categorias_producto_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_categorias_producto_nid_seq OWNED BY public.bot_categorias_producto.nid;


--
-- Name: bot_citas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_citas (
    nid integer NOT NULL,
    npaciente_id integer,
    cpaciente character varying(200) NOT NULL,
    cdoctor character varying(200) NOT NULL,
    cespeciali character varying(200),
    csala character varying(50),
    tinicio timestamp without time zone NOT NULL,
    cestado character varying(20) DEFAULT 'Confirmada'::character varying NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    nmedico_id integer,
    CONSTRAINT bot_citas_cestado_check CHECK (((cestado)::text = ANY ((ARRAY['Confirmada'::character varying, 'En espera'::character varying, 'Atendida'::character varying])::text[])))
);


--
-- Name: bot_citas_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_citas_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_citas_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_citas_nid_seq OWNED BY public.bot_citas.nid;


--
-- Name: bot_componentes_producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_componentes_producto (
    nid integer NOT NULL,
    cnombre character varying(150) NOT NULL,
    cdescripcion text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now() NOT NULL,
    tmodifi timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_bot_componentes_producto_estado CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'I'::bpchar]))),
    CONSTRAINT chk_bot_componentes_producto_nombre_no_vacio CHECK ((btrim((cnombre)::text) <> ''::text))
);


--
-- Name: bot_componentes_producto_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_componentes_producto_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_componentes_producto_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_componentes_producto_nid_seq OWNED BY public.bot_componentes_producto.nid;


--
-- Name: bot_compras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_compras (
    nid integer NOT NULL,
    ccodigo character varying(20) NOT NULL,
    nproveedor_id integer,
    cproveedor character varying(200),
    cdocumento character varying(50),
    ntotal numeric(12,2) DEFAULT 0,
    cnotas text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    nusuario_id integer,
    tcreado timestamp without time zone DEFAULT now(),
    ctipo_comprobante character varying(20) DEFAULT 'FACTURA'::character varying,
    nalmacen_id integer,
    ctipo_pago character varying(10) DEFAULT 'CONTADO'::character varying NOT NULL,
    tfecha_vencimiento date,
    CONSTRAINT bot_compras_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'C'::bpchar]))),
    CONSTRAINT chk_bot_compras_tipo_comprobante CHECK (((ctipo_comprobante)::text = 'FACTURA'::text)),
    CONSTRAINT chk_bot_compras_tipo_pago CHECK (((ctipo_pago)::text = ANY ((ARRAY['CONTADO'::character varying, 'CREDITO'::character varying])::text[])))
);


--
-- Name: COLUMN bot_compras.ctipo_pago; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_compras.ctipo_pago IS 'CONTADO: descarga inmediata de caja. CREDITO: genera cuenta por pagar.';


--
-- Name: COLUMN bot_compras.tfecha_vencimiento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_compras.tfecha_vencimiento IS 'Fecha de vencimiento de factura cuando ctipo_pago = CREDITO.';


--
-- Name: bot_compras_det; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_compras_det (
    nid integer NOT NULL,
    ncompra_id integer NOT NULL,
    nproducto_id integer NOT NULL,
    ncantidad integer DEFAULT 1 NOT NULL,
    npreunit numeric(10,2) NOT NULL,
    nsubtotal numeric(12,2) NOT NULL
);


--
-- Name: bot_compras_det_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_compras_det_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_compras_det_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_compras_det_nid_seq OWNED BY public.bot_compras_det.nid;


--
-- Name: bot_compras_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_compras_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_compras_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_compras_nid_seq OWNED BY public.bot_compras.nid;


--
-- Name: bot_compras_codigo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_compras_codigo_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_cuentas_por_pagar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_cuentas_por_pagar (
    nid integer NOT NULL,
    ncompra_id integer NOT NULL,
    nproveedor_id integer NOT NULL,
    nmonto_total numeric(10,2) NOT NULL,
    nmonto_pagado numeric(10,2) DEFAULT 0 NOT NULL,
    nsaldo numeric(10,2) GENERATED ALWAYS AS ((nmonto_total - nmonto_pagado)) STORED,
    tfecha_emision date DEFAULT CURRENT_DATE NOT NULL,
    tfecha_vencimiento date,
    cestado character varying(15) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    cdocumento character varying(50),
    cnotas text,
    nusuario_id integer,
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tmodifi timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_bot_cxp_estado CHECK (((cestado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PARCIAL'::character varying, 'PAGADA'::character varying, 'ANULADA'::character varying])::text[]))),
    CONSTRAINT chk_bot_cxp_montos CHECK (((nmonto_total >= (0)::numeric) AND (nmonto_pagado >= (0)::numeric) AND (nmonto_pagado <= nmonto_total)))
);


--
-- Name: TABLE bot_cuentas_por_pagar; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bot_cuentas_por_pagar IS 'Cuentas por pagar a proveedores. Se genera 1 fila al crear compra CREDITO. Saldo = total - pagado (generated).';


--
-- Name: bot_cuentas_por_pagar_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_cuentas_por_pagar_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_cuentas_por_pagar_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_cuentas_por_pagar_nid_seq OWNED BY public.bot_cuentas_por_pagar.nid;


--
-- Name: bot_deudores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_deudores (
    nid integer NOT NULL,
    cnombre character varying(200) NOT NULL,
    cdni character varying(11),
    ctelefono character varying(20),
    cconcepto text NOT NULL,
    nmonto numeric(12,2) NOT NULL,
    nabonado numeric(12,2) DEFAULT 0,
    ffecha date DEFAULT CURRENT_DATE,
    fvencimiento date,
    cnotas text,
    cestado character(1) DEFAULT 'P'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    CONSTRAINT bot_deudores_cestado_check CHECK ((cestado = ANY (ARRAY['P'::bpchar, 'A'::bpchar, 'C'::bpchar])))
);


--
-- Name: bot_deudores_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_deudores_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_deudores_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_deudores_nid_seq OWNED BY public.bot_deudores.nid;


--
-- Name: bot_familias_producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_familias_producto (
    nid integer NOT NULL,
    cnombre character varying(100) NOT NULL,
    cdescripcion text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    tmodifi timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE bot_familias_producto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bot_familias_producto IS 'Catálogo de familias comerciales de productos.';


--
-- Name: bot_familias_producto_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_familias_producto_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_familias_producto_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_familias_producto_nid_seq OWNED BY public.bot_familias_producto.nid;


--
-- Name: bot_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_historial (
    nid integer NOT NULL,
    npaciente_id integer NOT NULL,
    nmedico_id integer,
    cdoctor character varying(200),
    cfecha date DEFAULT CURRENT_DATE NOT NULL,
    cdiagnostico text,
    ctratamiento text,
    cobservacion text,
    csignos text,
    cadjuntos text,
    tcreado timestamp without time zone DEFAULT now()
);


--
-- Name: bot_historial_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_historial_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_historial_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_historial_nid_seq OWNED BY public.bot_historial.nid;


--
-- Name: bot_inventario_var; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_inventario_var (
    nid integer NOT NULL,
    cnombre character varying(200) NOT NULL,
    ccategoria character varying(100),
    cdescripcion text,
    ncantidad integer DEFAULT 1,
    nvalor numeric(12,2) DEFAULT 0,
    cubicacion character varying(100),
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    CONSTRAINT bot_inventario_var_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'I'::bpchar, 'P'::bpchar])))
);


--
-- Name: bot_inventario_var_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_inventario_var_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_inventario_var_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_inventario_var_nid_seq OWNED BY public.bot_inventario_var.nid;


--
-- Name: bot_kardex; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_kardex (
    nid integer NOT NULL,
    nproducto_id integer NOT NULL,
    ctipo character varying(30) NOT NULL,
    cref_tabla character varying(40),
    nref_id integer,
    ncantidad integer NOT NULL,
    nstock_anterior integer NOT NULL,
    nstock_nuevo integer NOT NULL,
    cdetalle text,
    nusuario_id integer,
    cusuario character varying(100),
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    nlote_id integer,
    ccodigo_lote character varying(100),
    nalmacen_id integer
);


--
-- Name: bot_kardex_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_kardex_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_kardex_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_kardex_nid_seq OWNED BY public.bot_kardex.nid;


--
-- Name: bot_locales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_locales (
    nid integer NOT NULL,
    cnombre character varying(120) NOT NULL,
    ccodigo character varying(20) NOT NULL,
    ctipo_local character varying(20) DEFAULT 'BOTICA'::character varying NOT NULL,
    cdireccion character varying(250),
    ctelefono character varying(30),
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tmodifi timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_locales_estado CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'I'::bpchar]))),
    CONSTRAINT chk_locales_tipo CHECK (((ctipo_local)::text = ANY ((ARRAY['BOTICA'::character varying, 'CLINICA'::character varying, 'OTRO'::character varying])::text[])))
);


--
-- Name: bot_locales_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_locales_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_locales_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_locales_nid_seq OWNED BY public.bot_locales.nid;


--
-- Name: bot_lotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_lotes (
    nid integer NOT NULL,
    nproducto_id integer NOT NULL,
    ncompra_id integer,
    ccodigo_lote character varying(100),
    dfechavencimiento date NOT NULL,
    ncantidad integer DEFAULT 0 NOT NULL,
    ncantidad_inicial integer DEFAULT 0 NOT NULL,
    cestado character varying(10) DEFAULT 'ACTIVO'::character varying NOT NULL,
    cnotas text,
    nversion integer DEFAULT 1 NOT NULL,
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tmodifi timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    nalmacen_id integer,
    nprecio_compra numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT chk_bot_lotes_cantidad CHECK ((ncantidad >= 0)),
    CONSTRAINT chk_bot_lotes_estado CHECK (((cestado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'AGOTADO'::character varying, 'VENCIDO'::character varying])::text[]))),
    CONSTRAINT chk_bot_lotes_precio_compra_non_negative CHECK ((nprecio_compra >= (0)::numeric))
);


--
-- Name: COLUMN bot_lotes.nprecio_compra; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_lotes.nprecio_compra IS 'Costo unitario de compra para el lote. Se hereda del bot_compras_det.npreunit al ingresar la compra.';


--
-- Name: bot_lotes_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_lotes_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_lotes_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_lotes_nid_seq OWNED BY public.bot_lotes.nid;


--
-- Name: bot_medicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_medicos (
    nid integer NOT NULL,
    cnombre character varying(200) NOT NULL,
    ccmp character varying(20),
    cespeciali character varying(100),
    ctelefono character varying(20),
    cemail character varying(100),
    cnotas text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    CONSTRAINT bot_medicos_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'I'::bpchar])))
);


--
-- Name: bot_medicos_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_medicos_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_medicos_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_medicos_nid_seq OWNED BY public.bot_medicos.nid;


--
-- Name: bot_movimientos_almacen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_movimientos_almacen (
    nid integer NOT NULL,
    nproducto_id integer NOT NULL,
    nlote_id integer,
    nalmacen_origen_id integer,
    nalmacen_destino_id integer,
    ctipo_movimiento character varying(30) NOT NULL,
    ncantidad integer NOT NULL,
    cdetalle text,
    nusuario_id integer,
    cusuario character varying(100),
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bot_movimientos_almacen_ncantidad_check CHECK ((ncantidad > 0)),
    CONSTRAINT chk_mov_tipo CHECK (((ctipo_movimiento)::text = ANY ((ARRAY['COMPRA'::character varying, 'VENTA'::character varying, 'CONSUMO_CLINICO'::character varying, 'TRASLADO'::character varying, 'DEVOLUCION_CLIENTE'::character varying, 'DEVOLUCION_PROVEEDOR'::character varying, 'BAJA'::character varying, 'AJUSTE'::character varying])::text[])))
);


--
-- Name: bot_movimientos_almacen_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_movimientos_almacen_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_movimientos_almacen_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_movimientos_almacen_nid_seq OWNED BY public.bot_movimientos_almacen.nid;


--
-- Name: bot_pacientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_pacientes (
    nid integer NOT NULL,
    cnombre character varying(200) NOT NULL,
    cnrodni character varying(11) NOT NULL,
    ctelefono character varying(20),
    nedad integer,
    cnotas text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    tultvisita date DEFAULT CURRENT_DATE,
    cesgenerico character(1) DEFAULT 'N'::bpchar NOT NULL,
    CONSTRAINT bot_pacientes_cesgenerico_check CHECK ((cesgenerico = ANY (ARRAY['S'::bpchar, 'N'::bpchar])))
);


--
-- Name: bot_pacientes_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_pacientes_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_pacientes_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_pacientes_nid_seq OWNED BY public.bot_pacientes.nid;


--
-- Name: bot_pagos_compras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_pagos_compras (
    nid integer NOT NULL,
    ncxp_id integer NOT NULL,
    ncaja_movimiento_id integer,
    nmonto numeric(10,2) NOT NULL,
    cmetodo_pago character varying(20) DEFAULT 'EFECTIVO'::character varying NOT NULL,
    cdocumento character varying(50),
    cnotas text,
    nusuario_id integer,
    cusuario character varying(100),
    cestado character varying(1) DEFAULT 'A'::character varying NOT NULL,
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_bot_pagos_compras_monto CHECK ((nmonto > (0)::numeric))
);


--
-- Name: TABLE bot_pagos_compras; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bot_pagos_compras IS 'Pagos aplicados a una CXP. Suma de nmonto debe igualar bot_cuentas_por_pagar.nmonto_pagado.';


--
-- Name: bot_pagos_compras_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_pagos_compras_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_pagos_compras_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_pagos_compras_nid_seq OWNED BY public.bot_pagos_compras.nid;


--
-- Name: bot_permisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_permisos (
    nid integer NOT NULL,
    nusuario_id integer NOT NULL,
    cseccion character varying(30) NOT NULL
);


--
-- Name: bot_permisos_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_permisos_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_permisos_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_permisos_nid_seq OWNED BY public.bot_permisos.nid;


--
-- Name: bot_producto_componentes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_producto_componentes (
    nid integer NOT NULL,
    nproducto_id integer NOT NULL,
    ncomponente_id integer NOT NULL,
    cconcentracion character varying(80),
    cforma character varying(80),
    cnotas text,
    tcreado timestamp without time zone DEFAULT now() NOT NULL,
    tmodifi timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: bot_producto_componentes_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_producto_componentes_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_producto_componentes_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_producto_componentes_nid_seq OWNED BY public.bot_producto_componentes.nid;


--
-- Name: bot_producto_precios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_producto_precios (
    nid integer NOT NULL,
    nproducto_id integer NOT NULL,
    cnombre character varying(20) NOT NULL,
    nprecio numeric(10,2) DEFAULT 0 NOT NULL,
    lactivo boolean DEFAULT true NOT NULL,
    nusuario_id integer,
    cusuario character varying(100),
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tmodifi timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_bot_producto_precios_no_neg CHECK ((nprecio >= (0)::numeric)),
    CONSTRAINT chk_bot_producto_precios_nombre CHECK (((cnombre)::text = ANY ((ARRAY['PRECIO_1'::character varying, 'PRECIO_2'::character varying, 'PRECIO_3'::character varying])::text[])))
);


--
-- Name: bot_producto_precios_hist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_producto_precios_hist (
    nid integer NOT NULL,
    nproducto_id integer NOT NULL,
    cnombre character varying(20) NOT NULL,
    nprecio_anterior numeric(10,2),
    nprecio_nuevo numeric(10,2) NOT NULL,
    caccion character varying(20) DEFAULT 'UPDATE'::character varying NOT NULL,
    nusuario_id integer,
    cusuario character varying(100),
    tcreado timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bot_producto_precios_hist_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_producto_precios_hist_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_producto_precios_hist_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_producto_precios_hist_nid_seq OWNED BY public.bot_producto_precios_hist.nid;


--
-- Name: bot_producto_precios_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_producto_precios_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_producto_precios_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_producto_precios_nid_seq OWNED BY public.bot_producto_precios.nid;


--
-- Name: bot_productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_productos (
    nid integer NOT NULL,
    ccodigo character varying(20) NOT NULL,
    cnombre character varying(200) NOT NULL,
    cgenerico character varying(200),
    ccategoria character varying(50) DEFAULT 'Medicamentos'::character varying NOT NULL,
    cfamilia character varying(100),
    cpresenta character varying(100),
    claborat character varying(100),
    nprecompra numeric(10,2) DEFAULT 0,
    npreventa numeric(10,2) DEFAULT 0,
    nstock integer DEFAULT 0,
    nstockmin integer DEFAULT 0,
    cubicacion character varying(50),
    cproveedor character varying(100),
    crotacion character varying(10) DEFAULT 'Media'::character varying,
    tvencimien date,
    creceta character(1) DEFAULT 'N'::bpchar,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    tmodifi timestamp without time zone DEFAULT now(),
    nproveedor_id integer,
    npreventa_2 numeric(10,2),
    npreventa_3 numeric(10,2),
    nfamilia_id integer,
    ncategoria_id integer,
    ctipo_producto character varying(30) DEFAULT 'MEDICAMENTO'::character varying NOT NULL,
    lrequiere_lote boolean DEFAULT true NOT NULL,
    lrequiere_vencimiento boolean DEFAULT true NOT NULL,
    CONSTRAINT bot_productos_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'I'::bpchar]))),
    CONSTRAINT bot_productos_creceta_check CHECK ((creceta = ANY (ARRAY['S'::bpchar, 'N'::bpchar]))),
    CONSTRAINT bot_productos_crotacion_check CHECK (((crotacion)::text = ANY ((ARRAY['Alta'::character varying, 'Media'::character varying, 'Baja'::character varying])::text[]))),
    CONSTRAINT bot_productos_ctipo_producto_check CHECK (((ctipo_producto)::text = ANY ((ARRAY['MEDICAMENTO'::character varying, 'NO_MEDICAMENTO'::character varying])::text[]))),
    CONSTRAINT chk_bot_productos_npreventa_2_non_negative CHECK (((npreventa_2 IS NULL) OR (npreventa_2 >= (0)::numeric))),
    CONSTRAINT chk_bot_productos_npreventa_3_non_negative CHECK (((npreventa_3 IS NULL) OR (npreventa_3 >= (0)::numeric))),
    CONSTRAINT chk_bot_productos_npreventa_non_negative CHECK ((npreventa >= (0)::numeric)),
    CONSTRAINT nstock_no_negativo CHECK ((nstock >= 0))
);


--
-- Name: COLUMN bot_productos.npreventa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_productos.npreventa IS 'Precio de venta principal (precio_venta_1). Campo historico reutilizado por compatibilidad.';


--
-- Name: COLUMN bot_productos.npreventa_2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_productos.npreventa_2 IS 'Precio de venta opcional 2.';


--
-- Name: COLUMN bot_productos.npreventa_3; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_productos.npreventa_3 IS 'Precio de venta opcional 3.';


--
-- Name: COLUMN bot_productos.nfamilia_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_productos.nfamilia_id IS 'Referencia opcional al catálogo bot_familias_producto. cfamilia se conserva por compatibilidad.';


--
-- Name: COLUMN bot_productos.ncategoria_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_productos.ncategoria_id IS 'Referencia opcional al catálogo bot_categorias_producto. ccategoria se conserva por compatibilidad.';


--
-- Name: COLUMN bot_productos.lrequiere_lote; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_productos.lrequiere_lote IS 'Si TRUE, las compras deben capturar código de lote para este producto.';


--
-- Name: COLUMN bot_productos.lrequiere_vencimiento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_productos.lrequiere_vencimiento IS 'Si TRUE, las compras deben capturar fecha de vencimiento para este producto.';


--
-- Name: bot_productos_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_productos_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_productos_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_productos_nid_seq OWNED BY public.bot_productos.nid;


--
-- Name: bot_proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_proveedores (
    nid integer NOT NULL,
    cruc character varying(11),
    cnombre character varying(200) NOT NULL,
    ccontacto character varying(200),
    ctelefono character varying(20),
    cemail character varying(100),
    cdireccion text,
    cnotas text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    CONSTRAINT bot_proveedores_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'I'::bpchar])))
);


--
-- Name: bot_proveedores_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_proveedores_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_proveedores_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_proveedores_nid_seq OWNED BY public.bot_proveedores.nid;


--
-- Name: bot_recetas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_recetas (
    nid integer NOT NULL,
    npaciente_id integer NOT NULL,
    nmedico_id integer,
    nhistorial_id integer,
    cdoctor character varying(200),
    cfecha date DEFAULT CURRENT_DATE NOT NULL,
    cdiagnostico text,
    cindicaciones text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    CONSTRAINT bot_recetas_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'D'::bpchar])))
);


--
-- Name: bot_recetas_det; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_recetas_det (
    nid integer NOT NULL,
    nreceta_id integer NOT NULL,
    nproducto_id integer,
    cmedicamento character varying(200) NOT NULL,
    cdosis character varying(100),
    cfrecuencia character varying(100),
    cduracion character varying(100),
    cnotas text
);


--
-- Name: bot_recetas_det_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_recetas_det_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_recetas_det_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_recetas_det_nid_seq OWNED BY public.bot_recetas_det.nid;


--
-- Name: bot_recetas_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_recetas_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_recetas_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_recetas_nid_seq OWNED BY public.bot_recetas.nid;


--
-- Name: bot_servicios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_servicios (
    nid integer NOT NULL,
    cnombre character varying(200) NOT NULL,
    ccategoria character varying(100) DEFAULT 'General'::character varying,
    nprecio numeric(10,2) DEFAULT 0,
    cdescripcion text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    CONSTRAINT bot_servicios_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'I'::bpchar])))
);


--
-- Name: bot_servicios_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_servicios_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_servicios_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_servicios_nid_seq OWNED BY public.bot_servicios.nid;


--
-- Name: bot_transferencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_transferencias (
    nid integer NOT NULL,
    ccodigo character varying(20) NOT NULL,
    ctipo character varying(30) NOT NULL,
    corigen character varying(100),
    cdestino character varying(100),
    cmotivo text,
    nusuario_id integer,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    CONSTRAINT bot_transferencias_ctipo_check CHECK (((ctipo)::text = ANY ((ARRAY['Transferencia'::character varying, 'Muestra'::character varying, 'Donacion'::character varying, 'Regalo'::character varying, 'Merma'::character varying, 'Entrada'::character varying])::text[])))
);


--
-- Name: bot_transferencias_det; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_transferencias_det (
    nid integer NOT NULL,
    ntransf_id integer NOT NULL,
    nproducto_id integer NOT NULL,
    ncantidad integer NOT NULL,
    cnotas text
);


--
-- Name: bot_transferencias_det_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_transferencias_det_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_transferencias_det_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_transferencias_det_nid_seq OWNED BY public.bot_transferencias_det.nid;


--
-- Name: bot_transferencias_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_transferencias_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_transferencias_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_transferencias_nid_seq OWNED BY public.bot_transferencias.nid;


--
-- Name: bot_usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_usuarios (
    nid integer NOT NULL,
    cnrodni character(8) NOT NULL,
    cnombre character varying(200) NOT NULL,
    cclave character varying(255) NOT NULL,
    crol character varying(20) DEFAULT 'caja'::character varying NOT NULL,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    tcreado timestamp without time zone DEFAULT now(),
    tmodifi timestamp without time zone DEFAULT now(),
    lsuper boolean DEFAULT false,
    ladmin boolean DEFAULT false,
    ctelefono character varying(20) DEFAULT ''::character varying,
    cdireccion character varying(300) DEFAULT ''::character varying,
    cemail character varying(200) DEFAULT ''::character varying,
    cclerk_user_id character varying(255),
    CONSTRAINT bot_usuarios_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'I'::bpchar])))
);


--
-- Name: COLUMN bot_usuarios.cclerk_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_usuarios.cclerk_user_id IS 'ID de usuario Clerk vinculado al usuario ERP. NULL cuando no está vinculado.';


--
-- Name: bot_usuarios_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_usuarios_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_usuarios_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_usuarios_nid_seq OWNED BY public.bot_usuarios.nid;


--
-- Name: bot_ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_ventas (
    nid integer NOT NULL,
    ccodigo character varying(20) NOT NULL,
    cnrodni_cli character varying(11),
    ccliente character varying(200) DEFAULT 'Consumidor final'::character varying,
    cmetpago character varying(20) DEFAULT 'Efectivo'::character varying NOT NULL,
    carea character varying(50) DEFAULT 'Botica'::character varying,
    ccaja character varying(50) DEFAULT 'Caja principal'::character varying,
    nsubtotal numeric(12,2) DEFAULT 0,
    nigv numeric(12,2) DEFAULT 0,
    ntotal numeric(12,2) DEFAULT 0,
    nmonto_efectivo numeric(12,2) DEFAULT 0 NOT NULL,
    nmonto_digital numeric(12,2) DEFAULT 0 NOT NULL,
    nvuelto numeric(12,2) DEFAULT 0 NOT NULL,
    cmetodo_pago_secundario character varying(20),
    cnotas text,
    cestado character(1) DEFAULT 'A'::bpchar NOT NULL,
    nusuario_id integer,
    tcreado timestamp without time zone DEFAULT now(),
    ncliente_clinico_id integer,
    nalmacen_id integer,
    CONSTRAINT bot_ventas_cestado_check CHECK ((cestado = ANY (ARRAY['A'::bpchar, 'F'::bpchar, 'C'::bpchar]))),
    CONSTRAINT bot_ventas_cmetpago_check CHECK (((cmetpago)::text = ANY ((ARRAY['Efectivo'::character varying, 'Yape'::character varying, 'Mixto'::character varying])::text[]))),
    CONSTRAINT chk_bot_ventas_pago_desglose_non_negative CHECK (((nmonto_efectivo >= (0)::numeric) AND (nmonto_digital >= (0)::numeric) AND (nvuelto >= (0)::numeric)))
);


--
-- Name: COLUMN bot_ventas.nmonto_efectivo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_ventas.nmonto_efectivo IS 'Monto efectivo recibido en la venta.';


--
-- Name: COLUMN bot_ventas.nmonto_digital; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_ventas.nmonto_digital IS 'Monto digital/tarjeta recibido en la venta.';


--
-- Name: COLUMN bot_ventas.nvuelto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_ventas.nvuelto IS 'Vuelto entregado al cliente.';


--
-- Name: COLUMN bot_ventas.cmetodo_pago_secundario; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bot_ventas.cmetodo_pago_secundario IS 'Método secundario usado en pago mixto.';


--
-- Name: bot_ventas_det; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_ventas_det (
    nid integer NOT NULL,
    nventa_id integer NOT NULL,
    nproducto_id integer,
    ncantidad integer DEFAULT 1 NOT NULL,
    npreunit numeric(10,2) NOT NULL,
    nsubtotal numeric(12,2) NOT NULL,
    ctipo character varying(20) DEFAULT 'Producto'::character varying,
    nservicio_id integer,
    cdescripcion character varying(200),
    nlote_id integer,
    clote_codigo character varying(100),
    CONSTRAINT bot_ventas_det_ctipo_check CHECK (((ctipo)::text = ANY ((ARRAY['Producto'::character varying, 'Servicio'::character varying])::text[])))
);


--
-- Name: bot_ventas_det_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_ventas_det_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_ventas_det_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_ventas_det_nid_seq OWNED BY public.bot_ventas_det.nid;


--
-- Name: bot_ventas_nid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_ventas_nid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_ventas_nid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bot_ventas_nid_seq OWNED BY public.bot_ventas.nid;


--
-- Name: bot_ventas_codigo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bot_ventas_codigo_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kardex; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kardex (
    id integer NOT NULL,
    tipo_movimiento_id integer,
    documento_tipo character varying(50),
    documento_id integer,
    producto_id integer,
    lote_id integer,
    sucursal_id integer,
    cantidad integer NOT NULL,
    cantidad_anterior integer,
    cantidad_nueva integer,
    costo_unitario numeric(12,4),
    costo_total numeric(12,2),
    precio_venta_unitario numeric(12,2),
    precio_venta_total numeric(12,2),
    es_fraccionado boolean DEFAULT false,
    unidad_medida_venta character varying(20),
    cantidad_unidades integer,
    receta_id integer,
    motivo text,
    usuario_id integer,
    usuario_nombre character varying(100),
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: kardex_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kardex_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kardex_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kardex_id_seq OWNED BY public.kardex.id;


--
-- Name: tipos_movimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_movimiento (
    id integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(50) NOT NULL,
    afecta_stock integer NOT NULL,
    es_entrada boolean DEFAULT false,
    es_salida boolean DEFAULT false,
    requiere_documento boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tipos_movimiento_afecta_stock_check CHECK ((afecta_stock = ANY (ARRAY['-1'::integer, 0, 1])))
);


--
-- Name: tipos_movimiento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tipos_movimiento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tipos_movimiento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tipos_movimiento_id_seq OWNED BY public.tipos_movimiento.id;


--
-- Name: vw_bot_lotes_fefo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bot_lotes_fefo AS
 SELECT DISTINCT ON (l.nproducto_id) l.nproducto_id,
    p.cnombre AS producto_nombre,
    p.ccodigo AS producto_codigo,
    p.nstock AS stock_total,
    l.nid AS lote_fefo_id,
    l.ccodigo_lote,
    l.dfechavencimiento,
    l.ncantidad AS cantidad_lote,
    (l.dfechavencimiento - CURRENT_DATE) AS dias_para_vencer,
        CASE
            WHEN (l.dfechavencimiento < CURRENT_DATE) THEN 'VENCIDO'::text
            WHEN ((l.dfechavencimiento - CURRENT_DATE) <= 30) THEN 'CRITICO'::text
            WHEN ((l.dfechavencimiento - CURRENT_DATE) <= 90) THEN 'PROXIMO'::text
            ELSE 'OK'::text
        END AS alerta_vencimiento
   FROM (public.bot_lotes l
     JOIN public.bot_productos p ON ((p.nid = l.nproducto_id)))
  WHERE (((l.cestado)::text = 'ACTIVO'::text) AND (l.ncantidad > 0) AND (l.dfechavencimiento >= CURRENT_DATE))
  ORDER BY l.nproducto_id, l.dfechavencimiento, l.tcreado;


--
-- Name: vw_stock_por_almacen; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_stock_por_almacen AS
 SELECT p.nid AS producto_id,
    p.ccodigo AS producto_codigo,
    p.cnombre AS producto_nombre,
    a.nid AS almacen_id,
    a.cnombre AS almacen_nombre,
    a.ctipo_almacen,
    a.bpermite_venta,
    a.bpermite_consumo_clinico,
    l2.nid AS local_id,
    l2.cnombre AS local_nombre,
    l2.ctipo_local,
    COALESCE(sum(lo.ncantidad) FILTER (WHERE ((lo.cestado)::text = 'ACTIVO'::text)), (0)::bigint) AS stock_disponible,
    count(lo.nid) FILTER (WHERE (((lo.cestado)::text = 'ACTIVO'::text) AND (lo.ncantidad > 0))) AS lotes_activos,
    min(lo.dfechavencimiento) FILTER (WHERE (((lo.cestado)::text = 'ACTIVO'::text) AND (lo.ncantidad > 0))) AS proximo_vencimiento
   FROM (((public.bot_productos p
     CROSS JOIN public.bot_almacenes a)
     JOIN public.bot_locales l2 ON ((l2.nid = a.nlocal_id)))
     LEFT JOIN public.bot_lotes lo ON (((lo.nproducto_id = p.nid) AND (lo.nalmacen_id = a.nid))))
  WHERE ((p.cestado = 'A'::bpchar) AND (a.cestado = 'A'::bpchar) AND (l2.cestado = 'A'::bpchar))
  GROUP BY p.nid, p.ccodigo, p.cnombre, a.nid, a.cnombre, a.ctipo_almacen, a.bpermite_venta, a.bpermite_consumo_clinico, l2.nid, l2.cnombre, l2.ctipo_local
 HAVING (COALESCE(sum(lo.ncantidad) FILTER (WHERE ((lo.cestado)::text = 'ACTIVO'::text)), (0)::bigint) > 0);


--
-- Name: bot_almacenes nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_almacenes ALTER COLUMN nid SET DEFAULT nextval('public.bot_almacenes_nid_seq'::regclass);


--
-- Name: bot_alquileres nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_alquileres ALTER COLUMN nid SET DEFAULT nextval('public.bot_alquileres_nid_seq'::regclass);


--
-- Name: bot_auditoria nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_auditoria ALTER COLUMN nid SET DEFAULT nextval('public.bot_auditoria_nid_seq'::regclass);


--
-- Name: bot_caja nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_caja ALTER COLUMN nid SET DEFAULT nextval('public.bot_caja_nid_seq'::regclass);


--
-- Name: bot_caja_movimientos nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_caja_movimientos ALTER COLUMN nid SET DEFAULT nextval('public.bot_caja_movimientos_nid_seq'::regclass);


--
-- Name: bot_categorias_producto nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_categorias_producto ALTER COLUMN nid SET DEFAULT nextval('public.bot_categorias_producto_nid_seq'::regclass);


--
-- Name: bot_citas nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_citas ALTER COLUMN nid SET DEFAULT nextval('public.bot_citas_nid_seq'::regclass);


--
-- Name: bot_componentes_producto nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_componentes_producto ALTER COLUMN nid SET DEFAULT nextval('public.bot_componentes_producto_nid_seq'::regclass);


--
-- Name: bot_compras nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras ALTER COLUMN nid SET DEFAULT nextval('public.bot_compras_nid_seq'::regclass);


--
-- Name: bot_compras_det nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras_det ALTER COLUMN nid SET DEFAULT nextval('public.bot_compras_det_nid_seq'::regclass);


--
-- Name: bot_cuentas_por_pagar nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_cuentas_por_pagar ALTER COLUMN nid SET DEFAULT nextval('public.bot_cuentas_por_pagar_nid_seq'::regclass);


--
-- Name: bot_deudores nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_deudores ALTER COLUMN nid SET DEFAULT nextval('public.bot_deudores_nid_seq'::regclass);


--
-- Name: bot_familias_producto nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_familias_producto ALTER COLUMN nid SET DEFAULT nextval('public.bot_familias_producto_nid_seq'::regclass);


--
-- Name: bot_historial nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_historial ALTER COLUMN nid SET DEFAULT nextval('public.bot_historial_nid_seq'::regclass);


--
-- Name: bot_inventario_var nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_inventario_var ALTER COLUMN nid SET DEFAULT nextval('public.bot_inventario_var_nid_seq'::regclass);


--
-- Name: bot_kardex nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_kardex ALTER COLUMN nid SET DEFAULT nextval('public.bot_kardex_nid_seq'::regclass);


--
-- Name: bot_locales nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_locales ALTER COLUMN nid SET DEFAULT nextval('public.bot_locales_nid_seq'::regclass);


--
-- Name: bot_lotes nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_lotes ALTER COLUMN nid SET DEFAULT nextval('public.bot_lotes_nid_seq'::regclass);


--
-- Name: bot_medicos nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_medicos ALTER COLUMN nid SET DEFAULT nextval('public.bot_medicos_nid_seq'::regclass);


--
-- Name: bot_movimientos_almacen nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_movimientos_almacen ALTER COLUMN nid SET DEFAULT nextval('public.bot_movimientos_almacen_nid_seq'::regclass);


--
-- Name: bot_pacientes nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_pacientes ALTER COLUMN nid SET DEFAULT nextval('public.bot_pacientes_nid_seq'::regclass);


--
-- Name: bot_pagos_compras nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_pagos_compras ALTER COLUMN nid SET DEFAULT nextval('public.bot_pagos_compras_nid_seq'::regclass);


--
-- Name: bot_permisos nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_permisos ALTER COLUMN nid SET DEFAULT nextval('public.bot_permisos_nid_seq'::regclass);


--
-- Name: bot_producto_componentes nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_componentes ALTER COLUMN nid SET DEFAULT nextval('public.bot_producto_componentes_nid_seq'::regclass);


--
-- Name: bot_producto_precios nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_precios ALTER COLUMN nid SET DEFAULT nextval('public.bot_producto_precios_nid_seq'::regclass);


--
-- Name: bot_producto_precios_hist nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_precios_hist ALTER COLUMN nid SET DEFAULT nextval('public.bot_producto_precios_hist_nid_seq'::regclass);


--
-- Name: bot_productos nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_productos ALTER COLUMN nid SET DEFAULT nextval('public.bot_productos_nid_seq'::regclass);


--
-- Name: bot_proveedores nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_proveedores ALTER COLUMN nid SET DEFAULT nextval('public.bot_proveedores_nid_seq'::regclass);


--
-- Name: bot_recetas nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_recetas ALTER COLUMN nid SET DEFAULT nextval('public.bot_recetas_nid_seq'::regclass);


--
-- Name: bot_recetas_det nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_recetas_det ALTER COLUMN nid SET DEFAULT nextval('public.bot_recetas_det_nid_seq'::regclass);


--
-- Name: bot_servicios nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_servicios ALTER COLUMN nid SET DEFAULT nextval('public.bot_servicios_nid_seq'::regclass);


--
-- Name: bot_transferencias nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_transferencias ALTER COLUMN nid SET DEFAULT nextval('public.bot_transferencias_nid_seq'::regclass);


--
-- Name: bot_transferencias_det nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_transferencias_det ALTER COLUMN nid SET DEFAULT nextval('public.bot_transferencias_det_nid_seq'::regclass);


--
-- Name: bot_usuarios nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_usuarios ALTER COLUMN nid SET DEFAULT nextval('public.bot_usuarios_nid_seq'::regclass);


--
-- Name: bot_ventas nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas ALTER COLUMN nid SET DEFAULT nextval('public.bot_ventas_nid_seq'::regclass);


--
-- Name: bot_ventas_det nid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas_det ALTER COLUMN nid SET DEFAULT nextval('public.bot_ventas_det_nid_seq'::regclass);


--
-- Name: kardex id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex ALTER COLUMN id SET DEFAULT nextval('public.kardex_id_seq'::regclass);


--
-- Name: tipos_movimiento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_movimiento ALTER COLUMN id SET DEFAULT nextval('public.tipos_movimiento_id_seq'::regclass);


--
-- Name: bot_almacenes bot_almacenes_ccodigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_almacenes
    ADD CONSTRAINT bot_almacenes_ccodigo_key UNIQUE (ccodigo);


--
-- Name: bot_almacenes bot_almacenes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_almacenes
    ADD CONSTRAINT bot_almacenes_pkey PRIMARY KEY (nid);


--
-- Name: bot_alquileres bot_alquileres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_alquileres
    ADD CONSTRAINT bot_alquileres_pkey PRIMARY KEY (nid);


--
-- Name: bot_auditoria bot_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_auditoria
    ADD CONSTRAINT bot_auditoria_pkey PRIMARY KEY (nid);


--
-- Name: bot_caja_movimientos bot_caja_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_caja_movimientos
    ADD CONSTRAINT bot_caja_movimientos_pkey PRIMARY KEY (nid);


--
-- Name: bot_caja bot_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_caja
    ADD CONSTRAINT bot_caja_pkey PRIMARY KEY (nid);


--
-- Name: bot_categorias_producto bot_categorias_producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_categorias_producto
    ADD CONSTRAINT bot_categorias_producto_pkey PRIMARY KEY (nid);


--
-- Name: bot_citas bot_citas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_citas
    ADD CONSTRAINT bot_citas_pkey PRIMARY KEY (nid);


--
-- Name: bot_componentes_producto bot_componentes_producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_componentes_producto
    ADD CONSTRAINT bot_componentes_producto_pkey PRIMARY KEY (nid);


--
-- Name: bot_compras bot_compras_ccodigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras
    ADD CONSTRAINT bot_compras_ccodigo_key UNIQUE (ccodigo);


--
-- Name: bot_compras_det bot_compras_det_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras_det
    ADD CONSTRAINT bot_compras_det_pkey PRIMARY KEY (nid);


--
-- Name: bot_compras bot_compras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras
    ADD CONSTRAINT bot_compras_pkey PRIMARY KEY (nid);


--
-- Name: bot_cuentas_por_pagar bot_cuentas_por_pagar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_cuentas_por_pagar
    ADD CONSTRAINT bot_cuentas_por_pagar_pkey PRIMARY KEY (nid);


--
-- Name: bot_deudores bot_deudores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_deudores
    ADD CONSTRAINT bot_deudores_pkey PRIMARY KEY (nid);


--
-- Name: bot_familias_producto bot_familias_producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_familias_producto
    ADD CONSTRAINT bot_familias_producto_pkey PRIMARY KEY (nid);


--
-- Name: bot_historial bot_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_historial
    ADD CONSTRAINT bot_historial_pkey PRIMARY KEY (nid);


--
-- Name: bot_inventario_var bot_inventario_var_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_inventario_var
    ADD CONSTRAINT bot_inventario_var_pkey PRIMARY KEY (nid);


--
-- Name: bot_kardex bot_kardex_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_kardex
    ADD CONSTRAINT bot_kardex_pkey PRIMARY KEY (nid);


--
-- Name: bot_locales bot_locales_ccodigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_locales
    ADD CONSTRAINT bot_locales_ccodigo_key UNIQUE (ccodigo);


--
-- Name: bot_locales bot_locales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_locales
    ADD CONSTRAINT bot_locales_pkey PRIMARY KEY (nid);


--
-- Name: bot_lotes bot_lotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_lotes
    ADD CONSTRAINT bot_lotes_pkey PRIMARY KEY (nid);


--
-- Name: bot_medicos bot_medicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_medicos
    ADD CONSTRAINT bot_medicos_pkey PRIMARY KEY (nid);


--
-- Name: bot_movimientos_almacen bot_movimientos_almacen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_movimientos_almacen
    ADD CONSTRAINT bot_movimientos_almacen_pkey PRIMARY KEY (nid);


--
-- Name: bot_pacientes bot_pacientes_cnrodni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_pacientes
    ADD CONSTRAINT bot_pacientes_cnrodni_key UNIQUE (cnrodni);


--
-- Name: bot_pacientes bot_pacientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_pacientes
    ADD CONSTRAINT bot_pacientes_pkey PRIMARY KEY (nid);


--
-- Name: bot_pagos_compras bot_pagos_compras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_pagos_compras
    ADD CONSTRAINT bot_pagos_compras_pkey PRIMARY KEY (nid);


--
-- Name: bot_permisos bot_permisos_nusuario_id_cseccion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_permisos
    ADD CONSTRAINT bot_permisos_nusuario_id_cseccion_key UNIQUE (nusuario_id, cseccion);


--
-- Name: bot_permisos bot_permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_permisos
    ADD CONSTRAINT bot_permisos_pkey PRIMARY KEY (nid);


--
-- Name: bot_producto_componentes bot_producto_componentes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_componentes
    ADD CONSTRAINT bot_producto_componentes_pkey PRIMARY KEY (nid);


--
-- Name: bot_producto_precios_hist bot_producto_precios_hist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_precios_hist
    ADD CONSTRAINT bot_producto_precios_hist_pkey PRIMARY KEY (nid);


--
-- Name: bot_producto_precios bot_producto_precios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_precios
    ADD CONSTRAINT bot_producto_precios_pkey PRIMARY KEY (nid);


--
-- Name: bot_productos bot_productos_ccodigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_productos
    ADD CONSTRAINT bot_productos_ccodigo_key UNIQUE (ccodigo);


--
-- Name: bot_productos bot_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_productos
    ADD CONSTRAINT bot_productos_pkey PRIMARY KEY (nid);


--
-- Name: bot_proveedores bot_proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_proveedores
    ADD CONSTRAINT bot_proveedores_pkey PRIMARY KEY (nid);


--
-- Name: bot_recetas_det bot_recetas_det_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_recetas_det
    ADD CONSTRAINT bot_recetas_det_pkey PRIMARY KEY (nid);


--
-- Name: bot_recetas bot_recetas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_recetas
    ADD CONSTRAINT bot_recetas_pkey PRIMARY KEY (nid);


--
-- Name: bot_servicios bot_servicios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_servicios
    ADD CONSTRAINT bot_servicios_pkey PRIMARY KEY (nid);


--
-- Name: bot_transferencias bot_transferencias_ccodigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_transferencias
    ADD CONSTRAINT bot_transferencias_ccodigo_key UNIQUE (ccodigo);


--
-- Name: bot_transferencias_det bot_transferencias_det_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_transferencias_det
    ADD CONSTRAINT bot_transferencias_det_pkey PRIMARY KEY (nid);


--
-- Name: bot_transferencias bot_transferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_transferencias
    ADD CONSTRAINT bot_transferencias_pkey PRIMARY KEY (nid);


--
-- Name: bot_usuarios bot_usuarios_cnrodni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_usuarios
    ADD CONSTRAINT bot_usuarios_cnrodni_key UNIQUE (cnrodni);


--
-- Name: bot_usuarios bot_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_usuarios
    ADD CONSTRAINT bot_usuarios_pkey PRIMARY KEY (nid);


--
-- Name: bot_ventas bot_ventas_ccodigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas
    ADD CONSTRAINT bot_ventas_ccodigo_key UNIQUE (ccodigo);


--
-- Name: bot_ventas_det bot_ventas_det_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas_det
    ADD CONSTRAINT bot_ventas_det_pkey PRIMARY KEY (nid);


--
-- Name: bot_ventas bot_ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas
    ADD CONSTRAINT bot_ventas_pkey PRIMARY KEY (nid);


--
-- Name: kardex kardex_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kardex
    ADD CONSTRAINT kardex_pkey PRIMARY KEY (id);


--
-- Name: tipos_movimiento tipos_movimiento_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_movimiento
    ADD CONSTRAINT tipos_movimiento_codigo_key UNIQUE (codigo);


--
-- Name: tipos_movimiento tipos_movimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_movimiento
    ADD CONSTRAINT tipos_movimiento_pkey PRIMARY KEY (id);


--
-- Name: bot_cuentas_por_pagar uq_bot_cxp_compra; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_cuentas_por_pagar
    ADD CONSTRAINT uq_bot_cxp_compra UNIQUE (ncompra_id);


--
-- Name: bot_producto_precios uq_bot_producto_precios_slot; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_precios
    ADD CONSTRAINT uq_bot_producto_precios_slot UNIQUE (nproducto_id, cnombre);


--
-- Name: idx_almacenes_local; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_almacenes_local ON public.bot_almacenes USING btree (nlocal_id);


--
-- Name: idx_almacenes_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_almacenes_tipo ON public.bot_almacenes USING btree (ctipo_almacen);


--
-- Name: idx_alquileres_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alquileres_estado ON public.bot_alquileres USING btree (cestado);


--
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_fecha ON public.bot_auditoria USING btree (tcreado);


--
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_usuario ON public.bot_auditoria USING btree (nusuario_id);


--
-- Name: idx_bot_caja_mov_caja; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_caja_mov_caja ON public.bot_caja_movimientos USING btree (ncaja_id);


--
-- Name: idx_bot_caja_mov_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_caja_mov_ref ON public.bot_caja_movimientos USING btree (cref_tabla, nref_id);


--
-- Name: idx_bot_caja_mov_tipo_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_caja_mov_tipo_fecha ON public.bot_caja_movimientos USING btree (ctipo, tcreado DESC);


--
-- Name: idx_bot_compras_almacen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_compras_almacen ON public.bot_compras USING btree (nalmacen_id);


--
-- Name: idx_bot_compras_tipo_comprobante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_compras_tipo_comprobante ON public.bot_compras USING btree (ctipo_comprobante);


--
-- Name: idx_bot_cxp_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_cxp_pendientes ON public.bot_cuentas_por_pagar USING btree (tfecha_vencimiento) WHERE ((cestado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PARCIAL'::character varying])::text[]));


--
-- Name: idx_bot_cxp_proveedor_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_cxp_proveedor_estado ON public.bot_cuentas_por_pagar USING btree (nproveedor_id, cestado);


--
-- Name: idx_bot_kardex_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_kardex_fecha ON public.bot_kardex USING btree (tcreado DESC);


--
-- Name: idx_bot_kardex_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_kardex_lote ON public.bot_kardex USING btree (nlote_id) WHERE (nlote_id IS NOT NULL);


--
-- Name: idx_bot_kardex_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_kardex_producto ON public.bot_kardex USING btree (nproducto_id, tcreado DESC);


--
-- Name: idx_bot_kardex_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_kardex_ref ON public.bot_kardex USING btree (cref_tabla, nref_id);


--
-- Name: idx_bot_kardex_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_kardex_tipo ON public.bot_kardex USING btree (ctipo);


--
-- Name: idx_bot_lotes_compra; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_lotes_compra ON public.bot_lotes USING btree (ncompra_id);


--
-- Name: idx_bot_lotes_fefo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_lotes_fefo ON public.bot_lotes USING btree (nproducto_id, dfechavencimiento, tcreado) WHERE ((ncantidad > 0) AND ((cestado)::text = 'ACTIVO'::text));


--
-- Name: idx_bot_lotes_producto_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_lotes_producto_estado ON public.bot_lotes USING btree (nproducto_id, cestado);


--
-- Name: idx_bot_lotes_vencimiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_lotes_vencimiento ON public.bot_lotes USING btree (dfechavencimiento) WHERE ((cestado)::text = 'ACTIVO'::text);


--
-- Name: idx_bot_pagos_compras_cxp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_pagos_compras_cxp ON public.bot_pagos_compras USING btree (ncxp_id);


--
-- Name: idx_bot_producto_precios_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_producto_precios_activo ON public.bot_producto_precios USING btree (nproducto_id, lactivo) WHERE (lactivo = true);


--
-- Name: idx_bot_producto_precios_hist_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_producto_precios_hist_producto ON public.bot_producto_precios_hist USING btree (nproducto_id, tcreado DESC);


--
-- Name: idx_bot_producto_precios_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_producto_precios_producto ON public.bot_producto_precios USING btree (nproducto_id);


--
-- Name: idx_bot_ventas_det_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_ventas_det_lote ON public.bot_ventas_det USING btree (nlote_id) WHERE (nlote_id IS NOT NULL);


--
-- Name: idx_citas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_citas_fecha ON public.bot_citas USING btree (tinicio);


--
-- Name: idx_compras_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compras_fecha ON public.bot_compras USING btree (tcreado);


--
-- Name: idx_deudores_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deudores_estado ON public.bot_deudores USING btree (cestado);


--
-- Name: idx_historial_paciente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historial_paciente ON public.bot_historial USING btree (npaciente_id);


--
-- Name: idx_kardex_almacen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kardex_almacen ON public.bot_kardex USING btree (nalmacen_id) WHERE (nalmacen_id IS NOT NULL);


--
-- Name: idx_kardex_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kardex_lote ON public.kardex USING btree (lote_id);


--
-- Name: idx_kardex_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kardex_producto ON public.kardex USING btree (producto_id, fecha DESC);


--
-- Name: idx_lotes_almacen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lotes_almacen ON public.bot_lotes USING btree (nalmacen_id);


--
-- Name: idx_mov_destino; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_destino ON public.bot_movimientos_almacen USING btree (nalmacen_destino_id);


--
-- Name: idx_mov_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_fecha ON public.bot_movimientos_almacen USING btree (tcreado DESC);


--
-- Name: idx_mov_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_lote ON public.bot_movimientos_almacen USING btree (nlote_id);


--
-- Name: idx_mov_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_origen ON public.bot_movimientos_almacen USING btree (nalmacen_origen_id);


--
-- Name: idx_mov_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_producto ON public.bot_movimientos_almacen USING btree (nproducto_id);


--
-- Name: idx_mov_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_tipo ON public.bot_movimientos_almacen USING btree (ctipo_movimiento);


--
-- Name: idx_pacientes_dni; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pacientes_dni ON public.bot_pacientes USING btree (cnrodni);


--
-- Name: idx_permisos_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permisos_usuario ON public.bot_permisos USING btree (nusuario_id);


--
-- Name: idx_productos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_estado ON public.bot_productos USING btree (cestado);


--
-- Name: idx_productos_vencimiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_vencimiento ON public.bot_productos USING btree (tvencimien);


--
-- Name: idx_recetas_paciente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recetas_paciente ON public.bot_recetas USING btree (npaciente_id);


--
-- Name: idx_transferencias_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transferencias_fecha ON public.bot_transferencias USING btree (tcreado);


--
-- Name: idx_ventas_almacen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_almacen ON public.bot_ventas USING btree (nalmacen_id) WHERE (nalmacen_id IS NOT NULL);


--
-- Name: idx_ventas_cliente_clinico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_cliente_clinico_id ON public.bot_ventas USING btree (ncliente_clinico_id);


--
-- Name: idx_ventas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_estado ON public.bot_ventas USING btree (cestado);


--
-- Name: idx_ventas_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ventas_fecha ON public.bot_ventas USING btree (tcreado);


--
-- Name: ix_bot_categorias_producto_familia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bot_categorias_producto_familia ON public.bot_categorias_producto USING btree (nfamilia_id);


--
-- Name: ix_bot_producto_componentes_componente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bot_producto_componentes_componente ON public.bot_producto_componentes USING btree (ncomponente_id);


--
-- Name: ix_bot_producto_componentes_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bot_producto_componentes_producto ON public.bot_producto_componentes USING btree (nproducto_id);


--
-- Name: ix_bot_productos_categoria_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bot_productos_categoria_id ON public.bot_productos USING btree (ncategoria_id);


--
-- Name: ix_bot_productos_familia_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bot_productos_familia_id ON public.bot_productos USING btree (nfamilia_id);


--
-- Name: ux_bot_categorias_producto_nombre_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_bot_categorias_producto_nombre_activo ON public.bot_categorias_producto USING btree (lower(btrim((cnombre)::text))) WHERE (cestado = 'A'::bpchar);


--
-- Name: ux_bot_componentes_producto_nombre_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_bot_componentes_producto_nombre_activo ON public.bot_componentes_producto USING btree (lower(btrim((cnombre)::text))) WHERE (cestado = 'A'::bpchar);


--
-- Name: ux_bot_familias_producto_nombre_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_bot_familias_producto_nombre_activo ON public.bot_familias_producto USING btree (lower(btrim((cnombre)::text))) WHERE (cestado = 'A'::bpchar);


--
-- Name: ux_bot_medicos_ccmp; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_bot_medicos_ccmp ON public.bot_medicos USING btree (ccmp) WHERE (NULLIF(btrim((ccmp)::text), ''::text) IS NOT NULL);


--
-- Name: ux_bot_producto_componentes_producto_componente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_bot_producto_componentes_producto_componente ON public.bot_producto_componentes USING btree (nproducto_id, ncomponente_id);


--
-- Name: ux_bot_proveedores_cruc; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_bot_proveedores_cruc ON public.bot_proveedores USING btree (cruc) WHERE (NULLIF(btrim((cruc)::text), ''::text) IS NOT NULL);


--
-- Name: ux_bot_servicios_nombre_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_bot_servicios_nombre_categoria ON public.bot_servicios USING btree (lower(btrim((cnombre)::text)), lower(btrim((ccategoria)::text))) WHERE (cestado = 'A'::bpchar);


--
-- Name: ux_bot_usuarios_cclerk_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_bot_usuarios_cclerk_user_id ON public.bot_usuarios USING btree (cclerk_user_id) WHERE (cclerk_user_id IS NOT NULL);


--
-- Name: bot_cuentas_por_pagar trg_bot_cxp_tmodifi; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bot_cxp_tmodifi BEFORE UPDATE ON public.bot_cuentas_por_pagar FOR EACH ROW EXECUTE FUNCTION public.fn_bot_cxp_tmodifi();


--
-- Name: bot_lotes trg_bot_lotes_tmodifi; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bot_lotes_tmodifi BEFORE UPDATE ON public.bot_lotes FOR EACH ROW EXECUTE FUNCTION public.fn_bot_lotes_set_tmodifi();


--
-- Name: bot_producto_precios trg_bot_producto_precios_hist; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bot_producto_precios_hist AFTER INSERT OR UPDATE ON public.bot_producto_precios FOR EACH ROW EXECUTE FUNCTION public.fn_bot_producto_precios_hist();


--
-- Name: bot_producto_precios trg_bot_producto_precios_tmodifi; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bot_producto_precios_tmodifi BEFORE UPDATE ON public.bot_producto_precios FOR EACH ROW EXECUTE FUNCTION public.fn_bot_producto_precios_tmodifi();


--
-- Name: bot_producto_precios trg_sync_producto_precios_legacy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_producto_precios_legacy AFTER INSERT OR DELETE OR UPDATE ON public.bot_producto_precios FOR EACH ROW EXECUTE FUNCTION public.fn_sync_producto_precios_legacy();


--
-- Name: bot_almacenes bot_almacenes_nlocal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_almacenes
    ADD CONSTRAINT bot_almacenes_nlocal_id_fkey FOREIGN KEY (nlocal_id) REFERENCES public.bot_locales(nid) ON DELETE RESTRICT;


--
-- Name: bot_auditoria bot_auditoria_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_auditoria
    ADD CONSTRAINT bot_auditoria_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid);


--
-- Name: bot_caja_movimientos bot_caja_movimientos_ncaja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_caja_movimientos
    ADD CONSTRAINT bot_caja_movimientos_ncaja_id_fkey FOREIGN KEY (ncaja_id) REFERENCES public.bot_caja(nid) ON DELETE RESTRICT;


--
-- Name: bot_caja_movimientos bot_caja_movimientos_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_caja_movimientos
    ADD CONSTRAINT bot_caja_movimientos_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid) ON DELETE SET NULL;


--
-- Name: bot_caja bot_caja_ncerrado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_caja
    ADD CONSTRAINT bot_caja_ncerrado_por_id_fkey FOREIGN KEY (ncerrado_por_id) REFERENCES public.bot_usuarios(nid);


--
-- Name: bot_caja bot_caja_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_caja
    ADD CONSTRAINT bot_caja_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid);


--
-- Name: bot_categorias_producto bot_categorias_producto_nfamilia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_categorias_producto
    ADD CONSTRAINT bot_categorias_producto_nfamilia_id_fkey FOREIGN KEY (nfamilia_id) REFERENCES public.bot_familias_producto(nid);


--
-- Name: bot_citas bot_citas_nmedico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_citas
    ADD CONSTRAINT bot_citas_nmedico_id_fkey FOREIGN KEY (nmedico_id) REFERENCES public.bot_medicos(nid);


--
-- Name: bot_citas bot_citas_npaciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_citas
    ADD CONSTRAINT bot_citas_npaciente_id_fkey FOREIGN KEY (npaciente_id) REFERENCES public.bot_pacientes(nid);


--
-- Name: bot_compras_det bot_compras_det_ncompra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras_det
    ADD CONSTRAINT bot_compras_det_ncompra_id_fkey FOREIGN KEY (ncompra_id) REFERENCES public.bot_compras(nid);


--
-- Name: bot_compras_det bot_compras_det_nproducto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras_det
    ADD CONSTRAINT bot_compras_det_nproducto_id_fkey FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid);


--
-- Name: bot_compras bot_compras_nproveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras
    ADD CONSTRAINT bot_compras_nproveedor_id_fkey FOREIGN KEY (nproveedor_id) REFERENCES public.bot_proveedores(nid);


--
-- Name: bot_compras bot_compras_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras
    ADD CONSTRAINT bot_compras_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid);


--
-- Name: bot_cuentas_por_pagar bot_cuentas_por_pagar_ncompra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_cuentas_por_pagar
    ADD CONSTRAINT bot_cuentas_por_pagar_ncompra_id_fkey FOREIGN KEY (ncompra_id) REFERENCES public.bot_compras(nid) ON DELETE RESTRICT;


--
-- Name: bot_cuentas_por_pagar bot_cuentas_por_pagar_nproveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_cuentas_por_pagar
    ADD CONSTRAINT bot_cuentas_por_pagar_nproveedor_id_fkey FOREIGN KEY (nproveedor_id) REFERENCES public.bot_proveedores(nid) ON DELETE RESTRICT;


--
-- Name: bot_cuentas_por_pagar bot_cuentas_por_pagar_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_cuentas_por_pagar
    ADD CONSTRAINT bot_cuentas_por_pagar_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid) ON DELETE SET NULL;


--
-- Name: bot_historial bot_historial_nmedico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_historial
    ADD CONSTRAINT bot_historial_nmedico_id_fkey FOREIGN KEY (nmedico_id) REFERENCES public.bot_medicos(nid);


--
-- Name: bot_historial bot_historial_npaciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_historial
    ADD CONSTRAINT bot_historial_npaciente_id_fkey FOREIGN KEY (npaciente_id) REFERENCES public.bot_pacientes(nid);


--
-- Name: bot_kardex bot_kardex_nalmacen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_kardex
    ADD CONSTRAINT bot_kardex_nalmacen_id_fkey FOREIGN KEY (nalmacen_id) REFERENCES public.bot_almacenes(nid);


--
-- Name: bot_movimientos_almacen bot_movimientos_almacen_nalmacen_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_movimientos_almacen
    ADD CONSTRAINT bot_movimientos_almacen_nalmacen_destino_id_fkey FOREIGN KEY (nalmacen_destino_id) REFERENCES public.bot_almacenes(nid) ON DELETE RESTRICT;


--
-- Name: bot_movimientos_almacen bot_movimientos_almacen_nalmacen_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_movimientos_almacen
    ADD CONSTRAINT bot_movimientos_almacen_nalmacen_origen_id_fkey FOREIGN KEY (nalmacen_origen_id) REFERENCES public.bot_almacenes(nid) ON DELETE RESTRICT;


--
-- Name: bot_movimientos_almacen bot_movimientos_almacen_nlote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_movimientos_almacen
    ADD CONSTRAINT bot_movimientos_almacen_nlote_id_fkey FOREIGN KEY (nlote_id) REFERENCES public.bot_lotes(nid) ON DELETE SET NULL;


--
-- Name: bot_movimientos_almacen bot_movimientos_almacen_nproducto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_movimientos_almacen
    ADD CONSTRAINT bot_movimientos_almacen_nproducto_id_fkey FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid) ON DELETE RESTRICT;


--
-- Name: bot_pagos_compras bot_pagos_compras_ncaja_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_pagos_compras
    ADD CONSTRAINT bot_pagos_compras_ncaja_movimiento_id_fkey FOREIGN KEY (ncaja_movimiento_id) REFERENCES public.bot_caja_movimientos(nid) ON DELETE SET NULL;


--
-- Name: bot_pagos_compras bot_pagos_compras_ncxp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_pagos_compras
    ADD CONSTRAINT bot_pagos_compras_ncxp_id_fkey FOREIGN KEY (ncxp_id) REFERENCES public.bot_cuentas_por_pagar(nid) ON DELETE RESTRICT;


--
-- Name: bot_pagos_compras bot_pagos_compras_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_pagos_compras
    ADD CONSTRAINT bot_pagos_compras_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid) ON DELETE SET NULL;


--
-- Name: bot_permisos bot_permisos_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_permisos
    ADD CONSTRAINT bot_permisos_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid);


--
-- Name: bot_producto_componentes bot_producto_componentes_ncomponente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_componentes
    ADD CONSTRAINT bot_producto_componentes_ncomponente_id_fkey FOREIGN KEY (ncomponente_id) REFERENCES public.bot_componentes_producto(nid) ON DELETE RESTRICT;


--
-- Name: bot_producto_componentes bot_producto_componentes_nproducto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_componentes
    ADD CONSTRAINT bot_producto_componentes_nproducto_id_fkey FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid) ON DELETE CASCADE;


--
-- Name: bot_producto_precios_hist bot_producto_precios_hist_nproducto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_precios_hist
    ADD CONSTRAINT bot_producto_precios_hist_nproducto_id_fkey FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid) ON DELETE CASCADE;


--
-- Name: bot_producto_precios_hist bot_producto_precios_hist_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_precios_hist
    ADD CONSTRAINT bot_producto_precios_hist_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid) ON DELETE SET NULL;


--
-- Name: bot_producto_precios bot_producto_precios_nproducto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_precios
    ADD CONSTRAINT bot_producto_precios_nproducto_id_fkey FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid) ON DELETE CASCADE;


--
-- Name: bot_producto_precios bot_producto_precios_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_producto_precios
    ADD CONSTRAINT bot_producto_precios_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid) ON DELETE SET NULL;


--
-- Name: bot_productos bot_productos_ncategoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_productos
    ADD CONSTRAINT bot_productos_ncategoria_id_fkey FOREIGN KEY (ncategoria_id) REFERENCES public.bot_categorias_producto(nid);


--
-- Name: bot_productos bot_productos_nfamilia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_productos
    ADD CONSTRAINT bot_productos_nfamilia_id_fkey FOREIGN KEY (nfamilia_id) REFERENCES public.bot_familias_producto(nid);


--
-- Name: bot_productos bot_productos_nproveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_productos
    ADD CONSTRAINT bot_productos_nproveedor_id_fkey FOREIGN KEY (nproveedor_id) REFERENCES public.bot_proveedores(nid);


--
-- Name: bot_recetas_det bot_recetas_det_nproducto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_recetas_det
    ADD CONSTRAINT bot_recetas_det_nproducto_id_fkey FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid);


--
-- Name: bot_recetas_det bot_recetas_det_nreceta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_recetas_det
    ADD CONSTRAINT bot_recetas_det_nreceta_id_fkey FOREIGN KEY (nreceta_id) REFERENCES public.bot_recetas(nid);


--
-- Name: bot_recetas bot_recetas_nhistorial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_recetas
    ADD CONSTRAINT bot_recetas_nhistorial_id_fkey FOREIGN KEY (nhistorial_id) REFERENCES public.bot_historial(nid);


--
-- Name: bot_recetas bot_recetas_nmedico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_recetas
    ADD CONSTRAINT bot_recetas_nmedico_id_fkey FOREIGN KEY (nmedico_id) REFERENCES public.bot_medicos(nid);


--
-- Name: bot_recetas bot_recetas_npaciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_recetas
    ADD CONSTRAINT bot_recetas_npaciente_id_fkey FOREIGN KEY (npaciente_id) REFERENCES public.bot_pacientes(nid);


--
-- Name: bot_transferencias_det bot_transferencias_det_nproducto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_transferencias_det
    ADD CONSTRAINT bot_transferencias_det_nproducto_id_fkey FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid);


--
-- Name: bot_transferencias_det bot_transferencias_det_ntransf_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_transferencias_det
    ADD CONSTRAINT bot_transferencias_det_ntransf_id_fkey FOREIGN KEY (ntransf_id) REFERENCES public.bot_transferencias(nid);


--
-- Name: bot_transferencias bot_transferencias_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_transferencias
    ADD CONSTRAINT bot_transferencias_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid);


--
-- Name: bot_ventas_det bot_ventas_det_nproducto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas_det
    ADD CONSTRAINT bot_ventas_det_nproducto_id_fkey FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid);


--
-- Name: bot_ventas_det bot_ventas_det_nservicio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas_det
    ADD CONSTRAINT bot_ventas_det_nservicio_id_fkey FOREIGN KEY (nservicio_id) REFERENCES public.bot_servicios(nid);


--
-- Name: bot_ventas_det bot_ventas_det_nventa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas_det
    ADD CONSTRAINT bot_ventas_det_nventa_id_fkey FOREIGN KEY (nventa_id) REFERENCES public.bot_ventas(nid);


--
-- Name: bot_ventas bot_ventas_nalmacen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas
    ADD CONSTRAINT bot_ventas_nalmacen_id_fkey FOREIGN KEY (nalmacen_id) REFERENCES public.bot_almacenes(nid);


--
-- Name: bot_ventas bot_ventas_ncliente_clinico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas
    ADD CONSTRAINT bot_ventas_ncliente_clinico_id_fkey FOREIGN KEY (ncliente_clinico_id) REFERENCES public.bot_pacientes(nid);


--
-- Name: bot_ventas bot_ventas_nusuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas
    ADD CONSTRAINT bot_ventas_nusuario_id_fkey FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid);


--
-- Name: bot_compras fk_bot_compras_almacen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras
    ADD CONSTRAINT fk_bot_compras_almacen FOREIGN KEY (nalmacen_id) REFERENCES public.bot_almacenes(nid);


--
-- Name: bot_compras fk_bot_compras_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_compras
    ADD CONSTRAINT fk_bot_compras_usuario FOREIGN KEY (nusuario_id) REFERENCES public.bot_usuarios(nid) ON DELETE SET NULL;


--
-- Name: bot_lotes fk_bot_lotes_compra; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_lotes
    ADD CONSTRAINT fk_bot_lotes_compra FOREIGN KEY (ncompra_id) REFERENCES public.bot_compras(nid) ON DELETE SET NULL;


--
-- Name: bot_lotes fk_bot_lotes_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_lotes
    ADD CONSTRAINT fk_bot_lotes_producto FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid) ON DELETE RESTRICT;


--
-- Name: bot_kardex fk_kardex_lote; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_kardex
    ADD CONSTRAINT fk_kardex_lote FOREIGN KEY (nlote_id) REFERENCES public.bot_lotes(nid) ON DELETE SET NULL;


--
-- Name: bot_kardex fk_kardex_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_kardex
    ADD CONSTRAINT fk_kardex_producto FOREIGN KEY (nproducto_id) REFERENCES public.bot_productos(nid) ON DELETE RESTRICT;


--
-- Name: bot_lotes fk_lotes_almacen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_lotes
    ADD CONSTRAINT fk_lotes_almacen FOREIGN KEY (nalmacen_id) REFERENCES public.bot_almacenes(nid) ON DELETE RESTRICT;


--
-- Name: bot_ventas_det fk_ventas_det_lote; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_ventas_det
    ADD CONSTRAINT fk_ventas_det_lote FOREIGN KEY (nlote_id) REFERENCES public.bot_lotes(nid) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict xpRImPZe6QObPzTtipsSQmcPZLKHI1prvaTwKaWlINlGbJqcQqAGfmV7JVHfuD5
