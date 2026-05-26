import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, UserPlus, FileText, Search, Phone, MessageCircle, Save, Trash2, Eye, Download, ChevronLeft, ChevronRight, Clock, User, Hash, X, Archive, NotebookPen, ArrowRight, StickyNote, Sparkles, Send, Brain, RefreshCw, Key, Mic, MicOff, HelpCircle, Plus, Library, BookmarkPlus, Check, Pencil } from 'lucide-react';
import { useAuth } from './auth/AuthProvider.jsx';
import Login from './auth/Login.jsx';
import { supabase } from './lib/supabaseClient.js';
import {
  loadAllData,
  migrateFromLocalStorage,
  loadApiKeyFromLocal,
  insertConsultante,
  updateConsultante,
  deleteConsultante,
  insertNota,
  updateNota,
  deleteNota,
  insertReporte,
  updateReporte,
  deleteReporte,
  insertCita,
  updateCita,
  deleteCita,
  upsertAyudaConversacion,
  deleteAyudaConversacion,
  insertBiblioteca,
  updateBibliotecaTitulo,
  deleteBiblioteca,
} from './lib/data/platformData.js';
import { notaFromRow, reporteFromRow, citaFromRow } from './lib/data/mappers.js';

const App = () => {
  const { session, authLoading } = useAuth();
  const userId = session?.user?.id;
  // ============ ESTADO PRINCIPAL ============
  const [activeTab, setActiveTab] = useState('calendario');
  const [consultantes, setConsultantes] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [notas, setNotas] = useState([]);
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);

  // ============ CALENDARIO ============
  const [vistaCalendario, setVistaCalendario] = useState('mensual');
  const [fechaActual, setFechaActual] = useState(new Date());
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [nuevaCita, setNuevaCita] = useState({ consultanteId: '', fecha: '', hora: '', horaFin: '', duracion: 60, notas: '' });
  const [citaEditando, setCitaEditando] = useState(null);

  // ============ ALTA CONSULTANTE ============
  const [nuevoConsultante, setNuevoConsultante] = useState({
    nombre: '', edad: '', telefono: '', motivoConsulta: '', quienRefiere: ''
  });
  const [consultanteEditando, setConsultanteEditando] = useState(null);
  const [consultanteVisualizando, setConsultanteVisualizando] = useState(null);

  // ============ PREPARACIÓN DE SESIÓN (CHAT IA) ============
  const [prepConsultanteId, setPrepConsultanteId] = useState('');
  const [prepMensajes, setPrepMensajes] = useState([]);
  const [prepInput, setPrepInput] = useState('');
  const [prepCargando, setPrepCargando] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [generandoReporteIA, setGenerandoReporteIA] = useState(false);

  // ============ AYUDA — CHAT ABIERTO ============
  const [showAyuda, setShowAyuda] = useState(false);
  const [ayudaVista, setAyudaVista] = useState('chat'); // 'chat' | 'lista'
  const [ayudaConversaciones, setAyudaConversaciones] = useState([]);
  const [ayudaActivaId, setAyudaActivaId] = useState(null);
  const [ayudaInput, setAyudaInput] = useState('');
  const [ayudaCargando, setAyudaCargando] = useState(false);

  // ============ MI BIBLIOTECA ============
  const [biblioteca, setBiblioteca] = useState([]);
  const [bibliotecaBusqueda, setBibliotecaBusqueda] = useState('');
  const [bibEditandoId, setBibEditandoId] = useState(null);
  const [bibTituloInput, setBibTituloInput] = useState('');

  // ============ NOTAS DE SESIÓN ============
  const [notaActual, setNotaActual] = useState({
    consultanteId: '', sesionNum: '', consultaDe: '',
    fecha: new Date().toISOString().split('T')[0],
    motivoConsulta: '', temaConsulta: '',
    contenido: ''
  });
  const [notaEditando, setNotaEditando] = useState(null);
  const [filtroNotasConsultante, setFiltroNotasConsultante] = useState('');
  const [dictando, setDictando] = useState(false);
  const [dictadoAviso, setDictadoAviso] = useState('');
  const [dictadoSoportado, setDictadoSoportado] = useState(true);
  const recognitionRef = useRef(null);
  const dictadoBaseRef = useRef('');
  const dictandoRef = useRef(false);
  const reinicioDictadoTimerRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDictadoSoportado(false);
    }
    return () => {
      dictandoRef.current = false;
      if (reinicioDictadoTimerRef.current) {
        clearTimeout(reinicioDictadoTimerRef.current);
        reinicioDictadoTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { /* noop */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  const detenerDictado = () => {
    dictandoRef.current = false;
    setDictadoAviso('');
    if (reinicioDictadoTimerRef.current) {
      clearTimeout(reinicioDictadoTimerRef.current);
      reinicioDictadoTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* noop */ }
      recognitionRef.current = null;
    }
    setDictando(false);
  };

  const programarReinicioDictado = (recognition) => {
    if (reinicioDictadoTimerRef.current) {
      clearTimeout(reinicioDictadoTimerRef.current);
    }
    reinicioDictadoTimerRef.current = setTimeout(() => {
      reinicioDictadoTimerRef.current = null;
      if (!dictandoRef.current) return;

      const intentarStart = (instancia) => {
        try {
          instancia.start();
          setDictadoAviso('');
        } catch (e) {
          console.warn('[dictado] reinicio falló, recreando:', e);
          const nuevo = crearRecognition();
          if (!nuevo || !dictandoRef.current) return;
          recognitionRef.current = nuevo;
          try {
            nuevo.start();
            setDictadoAviso('');
          } catch (e2) {
            console.warn('[dictado] no se pudo reiniciar:', e2);
            detenerDictado();
            alert('No se pudo reiniciar el dictado. Pulsa Dictar de nuevo.');
          }
        }
      };

      intentarStart(recognition);
    }, 300);
  };

  const crearRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[dictado] onstart');
      if (dictandoRef.current) setDictadoAviso('');
    };
    recognition.onaudiostart = () => console.log('[dictado] onaudiostart');
    recognition.onspeechstart = () => {
      console.log('[dictado] onspeechstart');
      setDictadoAviso('');
    };
    recognition.onspeechend = () => console.log('[dictado] onspeechend');
    recognition.onaudioend = () => console.log('[dictado] onaudioend');
    recognition.onnomatch = () => console.log('[dictado] onnomatch');

    recognition.onresult = (event) => {
      console.log('[dictado] onresult', event.results.length, 'resultIndex:', event.resultIndex);
      setDictadoAviso('');
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0] && result[0].transcript ? result[0].transcript : '';
        console.log('[dictado] result', i, 'isFinal:', result.isFinal, 'transcript:', JSON.stringify(transcript));
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (finalText) {
        const base = dictadoBaseRef.current;
        const separador = base && !base.endsWith(' ') && !base.endsWith('\n') ? ' ' : '';
        dictadoBaseRef.current = base + separador + finalText.trim() + ' ';
        setNotaActual(prev => ({ ...prev, contenido: dictadoBaseRef.current }));
      } else if (interimText) {
        setNotaActual(prev => ({ ...prev, contenido: dictadoBaseRef.current + interimText }));
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      if (event.error === 'no-speech') {
        console.log('[dictado] sin voz detectada, se reintentará escucha');
        if (dictandoRef.current) {
          setDictadoAviso('No se detectó voz. Habla ahora con claridad; el micrófono sigue activo.');
        }
        return;
      }
      console.warn('[dictado] onerror:', event.error, event);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        detenerDictado();
        alert('Permiso de micrófono denegado. Habilítalo en tu navegador para usar el dictado.');
      } else if (event.error === 'network') {
        detenerDictado();
        alert('Error de red en el reconocimiento de voz. Verifica tu conexión a internet.');
      }
    };

    recognition.onend = () => {
      console.log('[dictado] onend');
      if (!dictandoRef.current) {
        setDictando(false);
        return;
      }
      setDictadoAviso('Reconectando micrófono… puedes seguir hablando.');
      programarReinicioDictado(recognition);
    };

    return recognition;
  };

  const toggleDictado = async () => {
    if (dictando) {
      detenerDictado();
      return;
    }

    if (!window.isSecureContext) {
      alert('El dictado por voz requiere una conexión segura (HTTPS) o ejecutarse en localhost.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta dictado por voz. Usa Chrome, Edge o Safari.');
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn('[dictado] getUserMedia:', e);
        alert('No se pudo acceder al micrófono. Verifica los permisos del navegador y del sistema.');
        return;
      }
    }

    const recognition = crearRecognition();
    if (!recognition) {
      alert('Tu navegador no soporta dictado por voz. Usa Chrome, Edge o Safari.');
      return;
    }
    recognitionRef.current = recognition;
    dictadoBaseRef.current = notaActual.contenido || '';
    dictandoRef.current = true;
    setDictadoAviso('Iniciando micrófono… habla en cuanto veas “Escuchando”.');
    setDictando(true);
    try {
      recognition.start();
    } catch (e) {
      console.warn('No se pudo iniciar el dictado:', e);
      detenerDictado();
      alert('No se pudo iniciar el dictado: ' + (e?.message || e));
    }
  };

  // ============ REPORTE SESIÓN ============
  const ORIENTADOR_NOMBRE = 'CLAUDIA TALAMANTES DOSAL';
  const [reporteSesion, setReporteSesion] = useState({
    orientador: ORIENTADOR_NOMBRE, consultanteId: '', sesionNum: '', consultaDe: '', totalSesiones: '',
    fecha: new Date().toISOString().split('T')[0],
    motivoConsulta: '', temaConsulta: '', intervencion: '', autoObservacion: '', tiempoSesion: ''
  });
  const [reporteEditando, setReporteEditando] = useState(null);

  // ============ HISTORIAL ============
  const [filtroConsultante, setFiltroConsultante] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [reporteVisualizando, setReporteVisualizando] = useState(null);
  const [vistaArchivo, setVistaArchivo] = useState(null); // null | 'notas' | 'reportes'

  // ============ CARGA INICIAL (Supabase) ============
  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await migrateFromLocalStorage(userId);
        const data = await loadAllData(userId);
        if (cancelled) return;
        setConsultantes(data.consultantes);
        setSesiones(data.sesiones);
        setNotas(data.notas);
        setCitas(data.citas);
        setAyudaConversaciones(data.ayudaConversaciones);
        setBiblioteca(data.biblioteca);
        setApiKey(loadApiKeyFromLocal());
      } catch (e) {
        console.error('Error cargando datos:', e);
        alert(`Error cargando datos: ${e.message || e}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, authLoading]);

  // ============ CONSULTANTES ============
  const guardarConsultante = async () => {
    if (!userId) return;
    if (!nuevoConsultante.nombre || !nuevoConsultante.edad) {
      alert('Nombre y edad son obligatorios');
      return;
    }
    try {
      if (consultanteEditando) {
        const updated = await updateConsultante(userId, consultanteEditando, nuevoConsultante);
        setConsultantes((prev) => prev.map((c) => (c.id === consultanteEditando ? updated : c)));
      } else {
        const created = await insertConsultante(userId, nuevoConsultante);
        setConsultantes((prev) => [...prev, created]);
      }
    } catch (e) {
      alert(`Error guardando consultante: ${e.message || e}`);
      return;
    }
    setNuevoConsultante({ nombre: '', edad: '', telefono: '', motivoConsulta: '', quienRefiere: '' });
    setConsultanteEditando(null);
  };

  const editarConsultante = (c) => {
    setNuevoConsultante({ nombre: c.nombre, edad: c.edad, telefono: c.telefono, motivoConsulta: c.motivoConsulta, quienRefiere: c.quienRefiere });
    setConsultanteEditando(c.id);
  };

  const eliminarConsultante = async (id) => {
    if (!userId) return;
    if (!confirm('¿Eliminar consultante? Sus reportes se conservarán.')) return;
    try {
      await deleteConsultante(userId, id);
      setConsultantes((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert(`Error eliminando consultante: ${e.message || e}`);
    }
  };

  // ============ CHAT IA PREPARACIÓN ============
  const construirContextoConsultante = (consultanteId) => {
    const consultante = consultantes.find(c => c.id === consultanteId);
    if (!consultante) return '';

    const notasConsultante = notas
      .filter(n => n.consultanteId === consultanteId)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const reportesConsultante = sesiones
      .filter(s => s.consultanteId === consultanteId)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    let contexto = `FICHA DEL CONSULTANTE
═══════════════════════════════════
Nombre: ${consultante.nombre}
Edad: ${consultante.edad} años
Motivo de consulta inicial: ${consultante.motivoConsulta || 'No registrado'}
Quien refiere: ${consultante.quienRefiere || 'No registrado'}
`;

    if (notasConsultante.length > 0) {
      contexto += `\n\nHISTORIAL DE NOTAS DE SESIÓN (${notasConsultante.length} sesiones registradas)\n═══════════════════════════════════\n`;
      notasConsultante.forEach(n => {
        contexto += `\n— Consulta ${n.sesionNum || '?'} de ${n.consultaDe || '?'} | ${n.fecha} —\n`;
        if (n.motivoConsulta) contexto += `Motivo: ${n.motivoConsulta}\n`;
        if (n.temaConsulta) contexto += `Tema: ${n.temaConsulta}\n`;
        if (n.contenido) contexto += `Notas: ${n.contenido}\n`;
      });
    }

    if (reportesConsultante.length > 0) {
      contexto += `\n\nREPORTES FORMALES PREVIOS (${reportesConsultante.length})\n═══════════════════════════════════\n`;
      reportesConsultante.forEach(r => {
        contexto += `\n— Consulta ${r.sesionNum} de ${r.consultaDe} | ${r.fecha} —\n`;
        if (r.motivoConsulta) contexto += `Motivo: ${r.motivoConsulta}\n`;
        if (r.temaConsulta) contexto += `Tema: ${r.temaConsulta}\n`;
        if (r.intervencion) contexto += `Intervención: ${r.intervencion}\n`;
        if (r.autoObservacion) contexto += `Auto-observación: ${r.autoObservacion}\n`;
      });
    }

    if (notasConsultante.length === 0 && reportesConsultante.length === 0) {
      contexto += '\n\n(Aún no hay notas ni reportes previos para este consultante.)';
    }

    return contexto;
  };

  const enviarMensajeChat = async () => {
    if (!prepInput.trim() || !prepConsultanteId) return;

    const mensajeUsuario = { role: 'user', content: prepInput };
    const nuevosMensajes = [...prepMensajes, mensajeUsuario];
    setPrepMensajes(nuevosMensajes);
    setPrepInput('');
    setPrepCargando(true);

    const consultante = consultantes.find(c => c.id === prepConsultanteId);
    const contextoConsultante = construirContextoConsultante(prepConsultanteId);

    const systemPrompt = `Eres un supervisor clínico experto en LOGOTERAPIA de Viktor Frankl, con formación profunda en análisis existencial y técnicas frankleanas (diálogo socrático, derreflexión, intención paradójica, modificación de actitud, búsqueda de sentido).

Tu rol es asistir a una psicóloga logoterapeuta en la PREPARACIÓN de su sesión con un consultante específico. Conoces el historial completo del caso.

CONTEXTO COMPLETO DEL CASO:
${contextoConsultante}

LINEAMIENTOS PARA TUS RESPUESTAS:
0. Basa SIEMPRE tus respuestas en las NOTAS y los REPORTES DE LA SESIÓN del consultante seleccionado (incluidos arriba). Toda idea, hipótesis o sugerencia debe apoyarse en lo que aparece en esas notas y reportes; cita el dato concreto (fecha, tema, frase) que la sustenta. Si algo no consta en las notas ni en los reportes, dilo explícitamente y no lo des por hecho.
1. Habla con la psicóloga como un colega senior, no como un libro de texto.
2. Sé específico al caso — usa nombres, fechas, temas concretos del historial. Evita consejos genéricos.
3. Cuando sugieras técnicas logoterapéuticas, di POR QUÉ son apropiadas para este consultante en particular.
4. Si detectas patrones a través de las sesiones, señálalos explícitamente.
5. Responde en español mexicano profesional, directo, sin floritura.
6. Si la psicóloga te pide algo fuera del marco logoterapéutico (ej. técnicas cognitivo-conductuales puras), puedes integrarlas pero siempre desde la lente del sentido.
7. Estructura tus respuestas con claridad: usa listas cuando ayuden, párrafos cuando se necesite reflexión.
8. NO inventes datos del consultante que no estén en el contexto. Si falta información, dilo.
9. Mantén siempre la dignidad del consultante: hablamos DE él/ella, no SOBRE él/ella.

Te están preparando para acompañar la próxima sesión con ${consultante?.nombre || 'el consultante'}.`;

    try {
      if (!apiKey) {
        setPrepMensajes([...nuevosMensajes, {
          role: 'assistant',
          content: '⚠ Falta configurar la API Key de Anthropic. Da clic en el ícono de llave 🔑 arriba a la derecha del chat para pegarla.'
        }]);
        setPrepCargando(false);
        setShowApiKeyModal(true);
        return;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: systemPrompt,
          messages: nuevosMensajes.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'Error en la API');
      }

      const respuesta = data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      setPrepMensajes([...nuevosMensajes, { role: 'assistant', content: respuesta }]);
    } catch (error) {
      console.error('Error en chat:', error);
      setPrepMensajes([...nuevosMensajes, {
        role: 'assistant',
        content: `⚠ Hubo un problema al conectar con el sistema: ${error.message}. Verifica tu conexión y tu API Key.`
      }]);
    } finally {
      setPrepCargando(false);
    }
  };

  const limpiarChat = () => {
    if (prepMensajes.length > 0 && !confirm('¿Limpiar la conversación actual?')) return;
    setPrepMensajes([]);
  };

  // ============ AYUDA — CHAT ABIERTO ============
  const abrirAyuda = () => {
    setShowAyuda(true);
    if (ayudaConversaciones.length > 0) {
      setAyudaVista('lista');
    } else {
      setAyudaActivaId(null);
      setAyudaVista('chat');
    }
  };

  const nuevaConversacionAyuda = () => {
    setAyudaActivaId(null);
    setAyudaInput('');
    setAyudaVista('chat');
  };

  const abrirConversacionAyuda = (id) => {
    setAyudaActivaId(id);
    setAyudaVista('chat');
  };

  const eliminarConversacionAyuda = async (id) => {
    if (!userId) return;
    if (!confirm('¿Eliminar esta conversación? No se puede recuperar.')) return;
    try {
      await deleteAyudaConversacion(userId, id);
      setAyudaConversaciones((prev) => prev.filter((c) => c.id !== id));
      if (ayudaActivaId === id) {
        setAyudaActivaId(null);
        setAyudaVista('lista');
      }
    } catch (e) {
      alert(`Error eliminando conversación: ${e.message || e}`);
    }
  };

  const enviarMensajeAyuda = async () => {
    if (!userId) return;
    if (!ayudaInput.trim() || ayudaCargando) return;
    if (!apiKey) {
      setApiKeyInput(apiKey);
      setShowApiKeyModal(true);
      alert('Falta configurar la API Key de Anthropic. Pégala en la ventana que se abrió (ícono de llave) para usar el chat de AYUDA.');
      return;
    }

    const texto = ayudaInput.trim();
    const ahora = new Date().toISOString();
    const mensajeUsuario = { role: 'user', content: texto };

    let conv = ayudaActivaId ? ayudaConversaciones.find(c => c.id === ayudaActivaId) : null;
    if (!conv) {
      conv = { id: `ay_${Date.now()}`, titulo: texto.slice(0, 48) + (texto.length > 48 ? '…' : ''), mensajes: [], creada: ahora, actualizada: ahora };
    }

    const mensajesConUsuario = [...conv.mensajes, mensajeUsuario];
    const convConUsuario = { ...conv, mensajes: mensajesConUsuario, actualizada: ahora };

    let convPersistida;
    try {
      convPersistida = await upsertAyudaConversacion(userId, convConUsuario);
    } catch (e) {
      alert(`Error guardando conversación: ${e.message || e}`);
      return;
    }

    const convId = convPersistida.id;
    setAyudaActivaId(convId);
    setAyudaConversaciones((prev) => {
      const sinDuplicado = prev.filter((c) => c.id !== conv.id && c.id !== convId);
      return [convPersistida, ...sinDuplicado];
    });
    setAyudaInput('');
    setAyudaCargando(true);

    const systemPrompt = `Eres un asistente útil para Claudia, psicóloga especialista en logoterapia. Respondes con claridad, calidez y de forma directa en español mexicano.

Este es un chat abierto: puedes ayudar con cualquier pregunta del momento — dudas sobre logoterapia y técnicas frankleanas (diálogo socrático, derreflexión, intención paradójica, modificación de actitud, búsqueda de sentido), redacción, ideas, organización de su práctica clínica, o cualquier tema general.

Cuando la pregunta sea clínica, responde desde el marco de la logoterapia de Viktor Frankl cuando sea pertinente. No inventes datos de consultantes específicos; si necesitas información que no tienes, dilo. Estructura tus respuestas con claridad y sé conciso cuando la pregunta sea simple.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: systemPrompt,
          messages: mensajesConUsuario.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || 'Error en la API');

      const respuesta = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      const mensajeAsistente = { role: 'assistant', content: respuesta };
      const convFinal = {
        ...convPersistida,
        mensajes: [...mensajesConUsuario, mensajeAsistente],
        actualizada: new Date().toISOString(),
      };
      const guardada = await upsertAyudaConversacion(userId, convFinal);
      setAyudaConversaciones((prev) => prev.map((c) => (c.id === convId ? guardada : c)));
    } catch (error) {
      console.error('Error en AYUDA:', error);
      const mensajeError = { role: 'assistant', content: `⚠ Hubo un problema al conectar: ${error.message}. Verifica tu conexión y tu API Key.` };
      try {
        const convError = {
          ...convPersistida,
          mensajes: [...mensajesConUsuario, mensajeError],
          actualizada: new Date().toISOString(),
        };
        const guardada = await upsertAyudaConversacion(userId, convError);
        setAyudaConversaciones((prev) => prev.map((c) => (c.id === convId ? guardada : c)));
      } catch (e) {
        console.error(e);
      }
    } finally {
      setAyudaCargando(false);
    }
  };

  // ============ MI BIBLIOTECA ============
  const estaEnBiblioteca = (convId, idx) =>
    biblioteca.some(b => b.origen && b.origen.convId === convId && b.origen.idx === idx);

  const guardarEnBiblioteca = async (convId, idx) => {
    if (!userId) return;
    if (estaEnBiblioteca(convId, idx)) return;
    const conv = ayudaConversaciones.find(c => c.id === convId);
    if (!conv) return;
    const respuesta = conv.mensajes[idx];
    if (!respuesta || respuesta.role !== 'assistant') return;
    const pregunta = idx > 0 && conv.mensajes[idx - 1].role === 'user' ? conv.mensajes[idx - 1].content : '';
    const entrada = {
      titulo: (pregunta || respuesta.content).slice(0, 80),
      pregunta,
      respuesta: respuesta.content,
      fecha: new Date().toISOString(),
      origen: { convId, idx },
    };
    try {
      const guardada = await insertBiblioteca(userId, entrada);
      setBiblioteca((prev) => [guardada, ...prev]);
    } catch (e) {
      alert(`Error guardando en biblioteca: ${e.message || e}`);
    }
  };

  const eliminarDeBiblioteca = async (id) => {
    if (!userId) return;
    if (!confirm('¿Quitar esta respuesta de Mi Biblioteca?')) return;
    try {
      await deleteBiblioteca(userId, id);
      setBiblioteca((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      alert(`Error eliminando de biblioteca: ${e.message || e}`);
    }
  };

  const iniciarEdicionTitulo = (b) => {
    setBibEditandoId(b.id);
    setBibTituloInput(b.titulo || b.pregunta || '');
  };

  const guardarTituloBiblioteca = async () => {
    if (!userId) return;
    const titulo = bibTituloInput.trim();
    if (!titulo) { setBibEditandoId(null); return; }
    try {
      const actualizada = await updateBibliotecaTitulo(userId, bibEditandoId, titulo);
      setBiblioteca((prev) => prev.map((b) => (b.id === bibEditandoId ? actualizada : b)));
    } catch (e) {
      alert(`Error actualizando título: ${e.message || e}`);
    }
    setBibEditandoId(null);
    setBibTituloInput('');
  };

  const bibliotecaFiltrada = useMemo(() => {
    const q = bibliotecaBusqueda.trim().toLowerCase();
    const ordenada = [...biblioteca].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (!q) return ordenada;
    return ordenada.filter(b =>
      (b.titulo || '').toLowerCase().includes(q) ||
      (b.pregunta || '').toLowerCase().includes(q) ||
      (b.respuesta || '').toLowerCase().includes(q)
    );
  }, [biblioteca, bibliotecaBusqueda]);

  const generarReporteConIA = async () => {
    if (!reporteSesion.consultanteId) {
      alert('Selecciona primero un consultante.');
      return;
    }
    if (!apiKey) {
      alert('Falta configurar la API Key de Anthropic. Ábrela desde el ícono de llave en la pestaña "Preparando mi sesión".');
      setShowApiKeyModal(true);
      return;
    }
    const notasConsultante = notas
      .filter(n => n.consultanteId === reporteSesion.consultanteId)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const notasFecha = notasConsultante.filter(n => n.fecha === reporteSesion.fecha);
    const notasUsadas = notasFecha.length > 0 ? notasFecha : notasConsultante.slice(0, 1);
    if (notasUsadas.length === 0) {
      alert('No hay notas registradas para este consultante. Captura primero las notas en la pestaña "Notas de la Sesión".');
      return;
    }
    const consultante = consultantes.find(c => c.id === reporteSesion.consultanteId);
    const notasTexto = notasUsadas.map(n => (
      `Fecha: ${n.fecha}\nMotivo: ${n.motivoConsulta || '—'}\nTema: ${n.temaConsulta || '—'}\nNotas:\n${n.contenido || '—'}`
    )).join('\n\n---\n\n');

    const systemPrompt = `Analiza las siguientes notas de sesión y genera un reporte breve con lenguaje de logoterapia, pero escrito de forma clara, humana y casual.

Evita tecnicismos innecesarios, lenguaje clínico exagerado o frases artificiales como "se utilizaron diálogos socráticos", "se exploró fenomenológicamente" o expresiones similares.

El reporte debe sonar como si lo escribiera un especialista en logoterapia con experiencia, pero cercano y entendible para una persona normal.`;

    const userPrompt = `Genera el reporte de la sesión basándote ÚNICAMENTE en las siguientes notas.

Consultante: ${consultante?.nombre || '—'}${consultante?.edad ? ` (${consultante.edad} años)` : ''}
Fecha de la sesión: ${reporteSesion.fecha}

NOTAS DE LA SESIÓN:
${notasTexto}

Devuelve solo el texto del reporte, sin comentarios adicionales.`;

    setGenerandoReporteIA(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || 'Error en la API');
      const texto = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      setReporteSesion(prev => ({ ...prev, intervencion: texto }));
    } catch (error) {
      console.error('Error generando reporte:', error);
      alert(`No se pudo generar el reporte: ${error.message}`);
    } finally {
      setGenerandoReporteIA(false);
    }
  };

  // ============ NOTAS ============
  const guardarNota = async () => {
    if (!userId) return;
    if (!notaActual.consultanteId || !notaActual.fecha) {
      alert('Selecciona consultante y fecha');
      return;
    }
    const consultante = consultantes.find(c => c.id === notaActual.consultanteId);
    const motivoDelConsultante = consultante?.motivoConsulta || '';
    const payload = { ...notaActual, motivoConsulta: motivoDelConsultante };
    const eraEdicion = !!notaEditando;
    try {
      if (notaEditando) {
        const row = await updateNota(userId, notaEditando, payload, notaActual.consultanteId);
        const enriched = notaFromRow(row, consultantes);
        setNotas((prev) => prev.map((n) => (n.id === notaEditando ? enriched : n)));
      } else {
        const row = await insertNota(userId, payload, notaActual.consultanteId);
        const enriched = notaFromRow(row, consultantes);
        setNotas((prev) => [...prev, enriched]);
      }
    } catch (e) {
      alert(`Error guardando nota: ${e.message || e}`);
      return;
    }
    setNotaActual({
      consultanteId: '', sesionNum: '', consultaDe: '',
      fecha: new Date().toISOString().split('T')[0],
      motivoConsulta: '', temaConsulta: '',
      contenido: ''
    });
    setNotaEditando(null);
    alert(eraEdicion ? 'Nota actualizada' : 'Nota guardada correctamente');
  };

  const editarNota = (n) => {
    setNotaActual({
      consultanteId: n.consultanteId, sesionNum: n.sesionNum, consultaDe: n.consultaDe,
      fecha: n.fecha,
      motivoConsulta: n.motivoConsulta || '', temaConsulta: n.temaConsulta || '',
      contenido: n.contenido
    });
    setNotaEditando(n.id);
  };

  const eliminarNota = async (id) => {
    if (!userId) return;
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      await deleteNota(userId, id);
      setNotas((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      alert(`Error eliminando nota: ${e.message || e}`);
    }
  };

  const transferirNotaAReporte = (n) => {
    setReporteSesion({
      orientador: ORIENTADOR_NOMBRE,
      consultanteId: n.consultanteId,
      sesionNum: n.sesionNum || '',
      consultaDe: n.consultaDe || '',
      totalSesiones: reporteSesion.totalSesiones || '',
      fecha: n.fecha,
      motivoConsulta: n.motivoConsulta || '',
      temaConsulta: n.temaConsulta || '',
      intervencion: n.contenido || '',
      autoObservacion: '',
      tiempoSesion: ''
    });
    setReporteEditando(null);
    setActiveTab('reporte');
    alert('Notas transferidas al reporte. Completa los campos restantes y archívalo.');
  };

  // ============ REPORTES ============
  const guardarReporte = async () => {
    if (!userId) return;
    if (!reporteSesion.consultanteId || !reporteSesion.fecha) {
      alert('Selecciona un consultante y fecha');
      return;
    }
    const consultante = consultantes.find(c => c.id === reporteSesion.consultanteId);
    const motivoDelConsultante = consultante?.motivoConsulta || '';
    const totalSesionesGlobal = reporteSesion.totalSesiones || '';
    const payload = {
      ...reporteSesion,
      motivoConsulta: motivoDelConsultante,
      totalSesiones: totalSesionesGlobal,
    };
    let reporteGuardado;
    try {
      if (reporteEditando) {
        const row = await updateReporte(userId, reporteEditando, payload, reporteSesion.consultanteId);
        reporteGuardado = reporteFromRow(row, consultantes);
        setSesiones((prev) => prev.map((s) => (s.id === reporteEditando ? reporteGuardado : s)));
      } else {
        const row = await insertReporte(userId, payload, reporteSesion.consultanteId);
        reporteGuardado = reporteFromRow(row, consultantes);
        setSesiones((prev) => [...prev, reporteGuardado]);
      }
    } catch (e) {
      alert(`Error guardando reporte: ${e.message || e}`);
      return;
    }
    exportarReporte(reporteGuardado);
    setReporteSesion({
      orientador: ORIENTADOR_NOMBRE, consultanteId: '', sesionNum: '', consultaDe: '', totalSesiones: '',
      fecha: new Date().toISOString().split('T')[0],
      motivoConsulta: '', temaConsulta: '', intervencion: '', autoObservacion: '', tiempoSesion: ''
    });
    setReporteEditando(null);
  };

  const cargarReporte = (r) => {
    setReporteSesion({
      orientador: r.orientador, consultanteId: r.consultanteId, sesionNum: r.sesionNum, consultaDe: r.consultaDe || '', totalSesiones: r.totalSesiones,
      fecha: r.fecha, motivoConsulta: r.motivoConsulta, temaConsulta: r.temaConsulta,
      intervencion: r.intervencion, autoObservacion: r.autoObservacion, tiempoSesion: r.tiempoSesion
    });
    setReporteEditando(r.id);
    setActiveTab('reporte');
    setReporteVisualizando(null);
  };

  const eliminarReporte = async (id) => {
    if (!userId) return;
    if (!confirm('¿Eliminar este reporte?')) return;
    try {
      await deleteReporte(userId, id);
      setSesiones((prev) => prev.filter((s) => s.id !== id));
      setReporteVisualizando(null);
    } catch (e) {
      alert(`Error eliminando reporte: ${e.message || e}`);
    }
  };

  const exportarReporte = (r) => {
    const escape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const para = (s) => escape(s).replace(/\n/g, '<br>');
    const titulo = `Reporte_${(r.consultanteNombre || 'consultante').replace(/\s+/g, '_')}_C${r.sesionNum || ''}de${r.consultaDe || ''}_${r.fecha || ''}`;
    const html = `<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<title>${escape(titulo)}</title>
<style>
  @page { size: Letter; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0F1E33; margin: 0; padding: 0; line-height: 1.5; font-size: 12pt; }
  .header { border-bottom: 3px solid #1E3A5F; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { color: #1E3A5F; font-size: 20pt; margin: 0 0 4px 0; letter-spacing: 0.5px; }
  .header .sub { color: #5A6B80; font-size: 11pt; font-style: italic; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #F5EFE0; padding: 14px 18px; border-left: 4px solid #D9C4A0; margin-bottom: 24px; }
  .meta .lbl { font-size: 9pt; text-transform: uppercase; letter-spacing: 1.2px; color: #5A6B80; font-weight: 700; }
  .meta .val { font-size: 11pt; color: #0F1E33; font-weight: 600; }
  .section { margin-bottom: 22px; page-break-inside: avoid; }
  .section h2 { color: #1E3A5F; font-size: 13pt; margin: 0 0 8px 0; padding-bottom: 6px; border-bottom: 1px solid #E0D8C4; letter-spacing: 0.5px; }
  .section .body { font-size: 11pt; white-space: pre-wrap; }
  .section .label-inline { font-weight: 700; color: #1E3A5F; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 10px; display: block; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E0D8C4; font-size: 9pt; color: #5A6B80; text-align: center; }
  .actions { padding: 14px; background: #F5EFE0; text-align: center; }
  .actions button { padding: 10px 22px; font-size: 11pt; background: #1E3A5F; color: #fff; border: none; border-radius: 4px; cursor: pointer; margin: 0 4px; }
  @media print { .actions { display: none; } body { font-size: 11pt; } }
</style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
    <button onclick="window.close()" style="background:transparent;color:#1E3A5F;border:1px solid #1E3A5F;">Cerrar</button>
  </div>
  <div class="header">
    <h1>Reporte de Sesión de Logoterapia</h1>
  </div>
  <div class="meta">
    <div><div class="lbl">Orientador Logoterapéutico</div><div class="val">${escape(r.orientador || '—')}</div></div>
    <div><div class="lbl">Fecha</div><div class="val">${escape(r.fecha || '—')}</div></div>
    <div><div class="lbl">Consultante</div><div class="val">${escape(r.consultanteNombre || '—')}</div></div>
    <div><div class="lbl">Edad</div><div class="val">${escape(r.edad || '—')}</div></div>
    <div><div class="lbl">Consulta</div><div class="val">${escape(r.sesionNum || '—')} de ${escape(r.consultaDe || '—')}</div></div>
    <div><div class="lbl">Total de Sesiones</div><div class="val">${escape(r.totalSesiones || r.consultaDe || '—')}</div></div>
    <div><div class="lbl">Tiempo de la Sesión</div><div class="val">${escape(r.tiempoSesion || '—')}</div></div>
  </div>
  <div class="section">
    <h2>Motivo y Tema</h2>
    <span class="label-inline">Motivo de consulta</span>
    <div class="body">${para(r.motivoConsulta) || '—'}</div>
    <span class="label-inline">Tema de consulta</span>
    <div class="body">${para(r.temaConsulta) || '—'}</div>
  </div>
  <div class="section">
    <h2>Intervención</h2>
    <div class="body">${para(r.intervencion) || '—'}</div>
  </div>
  <div class="section">
    <h2>Cierre · Auto-Observación</h2>
    <div class="body">${para(r.autoObservacion) || '—'}</div>
  </div>
  <div class="footer">
    Generado el ${escape(new Date().toLocaleString('es-MX'))}
  </div>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      alert('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para esta página y vuelve a intentar.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = titulo;
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* el usuario puede imprimir manualmente */ } }, 350);
  };

  // ============ CITAS ============
  const minutosDeHora = (h) => {
    if (!h) return 0;
    const [hh, mm] = h.split(':').map(Number);
    return hh * 60 + mm;
  };

  const guardarCita = async () => {
    if (!userId) return;
    if (!nuevaCita.consultanteId || !nuevaCita.fecha || !nuevaCita.hora || !nuevaCita.horaFin) {
      alert('Completa consultante, fecha, hora de inicio y hora de fin');
      return;
    }
    const minIni = minutosDeHora(nuevaCita.hora);
    const minFin = minutosDeHora(nuevaCita.horaFin);
    if (minFin <= minIni) {
      alert('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }
    const citaPayload = { ...nuevaCita, duracion: minFin - minIni };
    try {
      if (citaEditando) {
        const row = await updateCita(userId, citaEditando, citaPayload, nuevaCita.consultanteId);
        const enriched = citaFromRow(row, consultantes);
        setCitas((prev) => prev.map((c) => (c.id === citaEditando ? enriched : c)));
      } else {
        const row = await insertCita(userId, citaPayload, nuevaCita.consultanteId);
        const enriched = citaFromRow(row, consultantes);
        setCitas((prev) => [...prev, enriched]);
      }
    } catch (e) {
      alert(`Error guardando cita: ${e.message || e}`);
      return;
    }
    setNuevaCita({ consultanteId: '', fecha: '', hora: '', horaFin: '', duracion: 60, notas: '' });
    setCitaEditando(null);
    setShowCitaModal(false);
  };

  const abrirCita = (cita) => {
    setNuevaCita({
      consultanteId: cita.consultanteId || '',
      fecha: cita.fecha || '',
      hora: cita.hora || '',
      horaFin: cita.horaFin || '',
      duracion: cita.duracion || 60,
      notas: cita.notas || ''
    });
    setCitaEditando(cita.id);
    setShowCitaModal(true);
  };

  const cerrarCitaModal = () => {
    setShowCitaModal(false);
    setCitaEditando(null);
    setNuevaCita({ consultanteId: '', fecha: '', hora: '', horaFin: '', duracion: 60, notas: '' });
  };

  const eliminarCita = async (id) => {
    if (!userId) return;
    if (!confirm('¿Eliminar esta cita?')) return;
    try {
      await deleteCita(userId, id);
      setCitas((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert(`Error eliminando cita: ${e.message || e}`);
    }
  };

  const eliminarCitaDesdeModal = async () => {
    if (!userId || !citaEditando) return;
    if (!confirm('¿Eliminar esta cita? Úsalo cuando el paciente cancele o ya no aplique.')) return;
    try {
      await deleteCita(userId, citaEditando);
      setCitas((prev) => prev.filter((c) => c.id !== citaEditando));
      cerrarCitaModal();
    } catch (e) {
      alert(`Error eliminando cita: ${e.message || e}`);
    }
  };

  const moverCita = async (citaId, nuevaFecha, nuevaHora) => {
    if (!userId) return;
    const cita = citas.find(c => c.id === citaId);
    if (!cita) return;
    const dur = cita.duracion || (cita.horaFin ? minutosDeHora(cita.horaFin) - minutosDeHora(cita.hora) : 60);
    let nuevaHoraFin = cita.horaFin;
    if (nuevaHora) {
      const finMin = minutosDeHora(nuevaHora) + dur;
      const fh = Math.floor(finMin / 60);
      const fm = finMin % 60;
      nuevaHoraFin = `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;
    }
    const citaPayload = {
      ...cita,
      fecha: nuevaFecha,
      ...(nuevaHora ? { hora: nuevaHora, horaFin: nuevaHoraFin } : {}),
      duracion: dur,
    };
    try {
      const row = await updateCita(userId, citaId, citaPayload, cita.consultanteId);
      const enriched = citaFromRow(row, consultantes);
      setCitas((prev) => prev.map((c) => (c.id === citaId ? enriched : c)));
    } catch (e) {
      alert(`Error moviendo cita: ${e.message || e}`);
    }
  };

  // ============ HELPERS CALENDARIO ============
  const cambiarFecha = (delta) => {
    const nueva = new Date(fechaActual);
    if (vistaCalendario === 'diario') nueva.setDate(nueva.getDate() + delta);
    else if (vistaCalendario === 'semanal') nueva.setDate(nueva.getDate() + delta * 7);
    else nueva.setMonth(nueva.getMonth() + delta);
    setFechaActual(nueva);
  };

  const formatoFecha = (d) => d.toISOString().split('T')[0];
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const horarios = [];
  for (let h = 8; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 21 && m > 0) break;
      horarios.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  const slotDeCita = (hora) => {
    if (!hora) return '';
    const [h, m] = hora.split(':').map(Number);
    const slotMin = Math.floor(m / 15) * 15;
    return `${String(h).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
  };

  const citasDelDia = (fecha) => citas.filter(c => c.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora));

  const diasMes = useMemo(() => {
    const año = fechaActual.getFullYear();
    const mes = fechaActual.getMonth();
    const primerDia = (new Date(año, mes, 1).getDay() + 6) % 7;
    const ultimoDia = new Date(año, mes + 1, 0).getDate();
    const dias = [];
    for (let i = 0; i < primerDia; i++) dias.push(null);
    for (let i = 1; i <= ultimoDia; i++) dias.push(new Date(año, mes, i));
    return dias;
  }, [fechaActual]);

  const semanaActual = useMemo(() => {
    const inicio = new Date(fechaActual);
    inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [fechaActual]);

  // ============ FILTRADO REPORTES ============
  const reportesFiltrados = useMemo(() => {
    return sesiones
      .filter(s => !filtroConsultante || s.consultanteId === filtroConsultante)
      .filter(s => {
        if (!busqueda) return true;
        const q = busqueda.toLowerCase();
        return s.consultanteNombre?.toLowerCase().includes(q) ||
               s.temaConsulta?.toLowerCase().includes(q) ||
               s.motivoConsulta?.toLowerCase().includes(q) ||
               s.intervencion?.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [sesiones, filtroConsultante, busqueda]);

  // ============ ESTILOS ============
  const colors = {
    bg: '#F5EFE0',           // Crema cálido - calma clínica
    cardBg: '#FFFFFF',
    primary: '#1E3A5F',      // Azul marino profundo - serenidad clínica
    primaryLight: '#3B5F8A',
    accent: '#D9C4A0',       // Crema dorado - autoridad profesional
    accentSoft: '#EDE0C5',
    text: '#0F1E33',
    textMuted: '#5A6B80',
    border: '#E0D8C4',
    danger: '#A04545',
    soft: '#EFE7D3',
    vino: '#6E1F2B',         // Rojo vino tinto - botón AYUDA
    vinoHover: '#8A2433'
  };

  const fontDisplay = "'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif";
  const fontBody = "'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif";
  const fontUI = "'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif";

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fontUI }}>
        <div style={{ color: colors.primary, fontSize: 18 }}>Cargando plataforma...</div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fontUI }}>
        <div style={{ color: colors.primary, fontSize: 18 }}>Validando sesión...</div>
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: fontUI, color: colors.text }}>

      {/* HEADER */}
      <header
        style={{
          position: 'relative',
          color: '#F5EFE0',
          padding: '28px 48px',
          background: 'radial-gradient(120% 100% at 0% 0%, #284B7A 0%, #1E3A5F 50%, #0F1E33 100%)',
          borderBottom: `1px solid rgba(201,162,74,0.45)`,
          boxShadow: '0 1px 0 rgba(245,239,224,0.06) inset, 0 6px 18px rgba(15,30,51,0.18)',
          overflow: 'hidden'
        }}
      >
        {/* Hairline dorado inferior */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 2,
            background: 'linear-gradient(to right, transparent 0%, #C9A24A 18%, #E9C77B 50%, #C9A24A 82%, transparent 100%)'
          }}
        />
        {/* Glow decorativo */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,162,74,0.18), transparent 65%)',
            pointerEvents: 'none'
          }}
        />

        <div style={{ position: 'relative', maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
          {/* IZQUIERDA: monograma + identidad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
            <svg width="56" height="56" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden style={{ flexShrink: 0 }}>
              <defs>
                <linearGradient id="hdrGold" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#E9C77B" />
                  <stop offset="55%" stopColor="#C9A24A" />
                  <stop offset="100%" stopColor="#8C6A28" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="56" stroke="rgba(245,239,224,0.18)" strokeWidth="1.5" />
              <circle cx="60" cy="60" r="49" stroke="#C9A24A" strokeOpacity="0.55" strokeWidth="0.75" />
              <path d="M78 38 C 66 30, 48 32, 40 44 C 32 56, 34 72, 44 80 C 54 88, 70 88, 78 82" stroke="url(#hdrGold)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <path d="M50 50 H 88 M 69 50 V 92" stroke="url(#hdrGold)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </svg>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.36em', textTransform: 'uppercase', color: '#C9A24A', fontWeight: 600, marginBottom: 4 }}>
                Logoterapia · Consulta Privada
              </div>
              <h1 style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 30,
                lineHeight: 1.05,
                margin: 0,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#F5EFE0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                Claudia <span style={{ fontStyle: 'italic', color: '#E9C77B' }}>Talamantes</span> Dosal
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{ display: 'inline-block', width: 22, height: 1, background: '#C9A24A' }} />
                <span style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E0D8C4' }}>
                  Logoterapeuta
                </span>
              </div>
            </div>
          </div>

          {/* CENTRO: cita Frankl */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 32px',
            minWidth: 0
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 'clamp(20px, 2vw, 28px)',
              lineHeight: 1.25,
              color: '#F5EFE0',
              letterSpacing: '0.005em',
              textAlign: 'center',
              fontWeight: 500
            }}>
              “El sentido se descubre, no se inventa.”
            </div>
            <div style={{
              marginTop: 6,
              fontSize: 10,
              letterSpacing: '0.36em',
              textTransform: 'uppercase',
              color: '#C9A24A',
              fontWeight: 600
            }}>
              Viktor E. Frankl
            </div>
          </div>

          {/* DERECHA: estado + fecha + salir */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: 'rgba(201,162,74,0.12)',
                  border: '1px solid rgba(201,162,74,0.45)',
                  fontSize: 10,
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: '#E9C77B',
                  fontWeight: 600
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E9C77B', boxShadow: '0 0 0 3px rgba(233,199,123,0.18)' }} />
                Sesión activa
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(245,239,224,0.35)',
                  color: '#F5EFE0',
                  padding: '7px 14px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  fontFamily: fontUI,
                  transition: 'background 120ms ease, border-color 120ms ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201,162,74,0.12)'; e.currentTarget.style.borderColor = 'rgba(201,162,74,0.5)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(245,239,224,0.35)'; }}
                title="Cerrar sesión"
              >
                Salir
              </button>
            </div>
            <div style={{ fontSize: 12, fontFamily: fontBody, marginTop: 8, color: '#C5D2E0', letterSpacing: '0.04em' }}>
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* TABS */}
      <nav style={{ background: colors.cardBg, borderBottom: `1px solid ${colors.border}`, padding: '0 48px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 0 }}>
          {[
            { id: 'calendario', label: 'Calendario', icon: Calendar },
            { id: 'alta', label: 'Nuevo Consultante', icon: UserPlus },
            { id: 'preparacion', label: 'Preparando mi sesión', icon: Sparkles },
            { id: 'notas', label: 'Notas de Sesión', icon: NotebookPen },
            { id: 'reporte', label: 'Reporte de Sesión', icon: FileText },
            { id: 'historial', label: 'Archivo Clínico', icon: Archive },
            { id: 'biblioteca', label: 'Mi Biblioteca', icon: Library }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '20px 28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? colors.primary : colors.textMuted,
                  borderBottom: active ? `2px solid ${colors.accent}` : '2px solid transparent',
                  transition: 'all 0.2s',
                  fontFamily: fontUI,
                  letterSpacing: 0.3
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 48px' }}>

        {/* ============ CALENDARIO ============ */}
        {activeTab === 'calendario' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: fontDisplay, fontSize: 32, margin: 0, color: colors.primary, fontWeight: 500 }}>
                  Agenda Clínica
                </h2>
                <p style={{ color: colors.textMuted, marginTop: 4, fontSize: 14 }}>Planeación de sesiones y citas</p>
              </div>
              <button
                onClick={() => { setCitaEditando(null); setNuevaCita({ consultanteId: '', fecha: '', hora: '', horaFin: '', duracion: 60, notas: '' }); setShowCitaModal(true); }}
                style={{
                  background: colors.primary, color: '#fff', border: 'none', padding: '12px 24px',
                  borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500, letterSpacing: 0.5,
                  textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                <UserPlus size={16} /> Nueva Cita
              </button>
            </div>

            {/* Controles vista */}
            <div style={{ background: colors.cardBg, padding: 20, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {['diario', 'semanal', 'mensual'].map(v => (
                  <button
                    key={v}
                    onClick={() => setVistaCalendario(v)}
                    style={{
                      padding: '8px 18px', border: `1px solid ${vistaCalendario === v ? colors.primary : colors.border}`,
                      background: vistaCalendario === v ? colors.primary : 'transparent',
                      color: vistaCalendario === v ? '#fff' : colors.text,
                      borderRadius: 4, cursor: 'pointer', fontSize: 13, textTransform: 'capitalize', fontWeight: 500
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => cambiarFecha(-1)} style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: 8, borderRadius: 4, cursor: 'pointer' }}>
                  <ChevronLeft size={16} />
                </button>
                <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 500, color: colors.primary, minWidth: 280, textAlign: 'center' }}>
                  {vistaCalendario === 'diario' && fechaActual.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {vistaCalendario === 'semanal' && `Semana del ${semanaActual[0].getDate()} de ${meses[semanaActual[0].getMonth()]}`}
                  {vistaCalendario === 'mensual' && `${meses[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`}
                </div>
                <button onClick={() => cambiarFecha(1)} style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: 8, borderRadius: 4, cursor: 'pointer' }}>
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => setFechaActual(new Date())} style={{ background: colors.soft, border: 'none', padding: '8px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                  HOY
                </button>
              </div>
            </div>

            {/* Vista Diaria */}
            {vistaCalendario === 'diario' && (() => {
              const HORA_INI = 8;
              const HORA_FIN = 21;
              const PX_HORA = 64;
              const LABEL_W = 72;
              const horas = [];
              for (let h = HORA_INI; h <= HORA_FIN; h++) horas.push(h);
              const formatHora12 = (h) => {
                if (h === 0) return '12 a.m.';
                if (h === 12) return '12 p.m.';
                return h < 12 ? `${h} a.m.` : `${h - 12} p.m.`;
              };
              const minDesdeInicio = (hora) => {
                if (!hora) return 0;
                const [hh, mm] = hora.split(':').map(Number);
                return (hh - HORA_INI) * 60 + mm;
              };
              const fechaStr = formatoFecha(fechaActual);
              const citasHoy = citasDelDia(fechaStr);
              const altoTotal = (HORA_FIN - HORA_INI) * PX_HORA;
              const ahora = new Date();
              const esHoy = formatoFecha(ahora) === fechaStr;
              const ahoraOffset = (ahora.getHours() - HORA_INI) * 60 + ahora.getMinutes();
              const mostrarAhora = esHoy && ahoraOffset >= 0 && ahoraOffset <= altoTotal;
              return (
                <div style={{ background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: LABEL_W, flexShrink: 0, position: 'relative', borderRight: `1px solid ${colors.border}`, paddingTop: 8 }}>
                      {horas.map(h => (
                        <div key={h} style={{ height: PX_HORA, position: 'relative' }}>
                          <div style={{ position: 'absolute', top: -7, right: 10, fontSize: 11, color: colors.textMuted, background: colors.cardBg, padding: '0 4px' }}>
                            {formatHora12(h)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      onClick={(e) => {
                        if (e.target !== e.currentTarget) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top - 8;
                        if (y < 0) return;
                        const totalMin = (y / PX_HORA) * 60;
                        const slotMin = Math.max(0, Math.floor(totalMin / 15) * 15);
                        const h = HORA_INI + Math.floor(slotMin / 60);
                        const m = slotMin % 60;
                        if (h > HORA_FIN) return;
                        const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        setCitaEditando(null);
                        setNuevaCita({ consultanteId: '', fecha: fechaStr, hora, horaFin: '', duracion: 60, notas: '' });
                        setShowCitaModal(true);
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('text/cita-id');
                        if (!id) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top - 8;
                        const totalMin = Math.max(0, (y / PX_HORA) * 60);
                        const slotMin = Math.floor(totalMin / 15) * 15;
                        const h = HORA_INI + Math.floor(slotMin / 60);
                        const m = slotMin % 60;
                        if (h > HORA_FIN) return;
                        const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        moverCita(id, fechaStr, hora);
                      }}
                      style={{ flex: 1, position: 'relative', height: altoTotal + 16, paddingTop: 8, cursor: 'pointer' }}
                      title="Clic para agendar · arrastra una cita para moverla"
                    >
                      {horas.map((h, i) => (
                        <div key={h} style={{ position: 'absolute', top: 8 + i * PX_HORA, left: 0, right: 0, height: PX_HORA, pointerEvents: 'none' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: `1px solid ${colors.border}` }} />
                          <div style={{ position: 'absolute', top: PX_HORA / 2, left: 0, right: 0, borderTop: `1px dashed ${colors.border}`, opacity: 0.6 }} />
                        </div>
                      ))}
                      {mostrarAhora && (
                        <div style={{ position: 'absolute', top: 8 + ahoraOffset, left: 0, right: 0, height: 0, borderTop: `2px solid ${colors.danger}`, zIndex: 5 }}>
                          <div style={{ position: 'absolute', left: -5, top: -6, width: 10, height: 10, borderRadius: '50%', background: colors.danger }} />
                        </div>
                      )}
                      {citasHoy.map(cita => {
                        const ini = minDesdeInicio(cita.hora);
                        const fin = cita.horaFin ? minDesdeInicio(cita.horaFin) : ini + (cita.duracion || 60);
                        const altura = Math.max((fin - ini) * (PX_HORA / 60), 28);
                        const top = 8 + ini * (PX_HORA / 60);
                        return (
                          <div
                            key={cita.id}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.setData('text/cita-id', cita.id); e.dataTransfer.effectAllowed = 'move'; }}
                            onClick={(e) => { e.stopPropagation(); abrirCita(cita); }}
                            title="Clic para abrir o editar esta cita"
                            style={{
                              position: 'absolute',
                              top, left: 12, right: 12, height: altura,
                              background: colors.accentSoft,
                              borderLeft: `4px solid ${colors.primary}`,
                              borderRadius: 4,
                              padding: '6px 32px 6px 10px',
                              overflow: 'hidden',
                              fontSize: 12,
                              zIndex: 2,
                              cursor: 'pointer'
                            }}>
                            <div style={{ fontWeight: 700, color: colors.primary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cita.consultanteNombre}
                            </div>
                            <div style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>
                              {cita.hora}{cita.horaFin ? ` — ${cita.horaFin}` : ''}
                            </div>
                            {cita.notas && altura > 56 && (
                              <div style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 2, overflow: 'hidden' }}>
                                {cita.notas}
                              </div>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); eliminarCita(cita.id); }} title="Eliminar cita" style={{ position: 'absolute', top: 4, right: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: colors.danger, padding: 2, display: 'flex' }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Vista Semanal */}
            {vistaCalendario === 'semanal' && (
              <div style={{ background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(5, 1fr) 0.5fr 0.5fr', borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ background: colors.soft, borderRight: `1px solid ${colors.border}` }} />
                  {semanaActual.map((d, i) => {
                    const esHoy = formatoFecha(d) === formatoFecha(new Date());
                    const esFinDeSemana = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={i} style={{ padding: 12, background: esHoy ? colors.primary : esFinDeSemana ? '#DCDCDC' : colors.soft, color: esHoy ? '#fff' : colors.text, textAlign: 'center', borderRight: i < 6 ? `1px solid ${colors.border}` : 'none' }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8 }}>{dias[(d.getDay() + 6) % 7]}</div>
                        <div style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                  {horarios.map((slot) => {
                    const esHora = slot.endsWith(':00');
                    return (
                      <div key={slot} style={{ display: 'grid', gridTemplateColumns: '70px repeat(5, 1fr) 0.5fr 0.5fr', borderBottom: esHora ? `1px solid ${colors.border}` : `1px dashed ${colors.border}` }}>
                        <div style={{ padding: '4px 8px', textAlign: 'right', fontSize: 11, color: colors.textMuted, background: colors.soft, borderRight: `1px solid ${colors.border}`, fontWeight: esHora ? 600 : 400 }}>
                          {slot}
                        </div>
                        {semanaActual.map((d, i) => {
                          const fechaD = formatoFecha(d);
                          const citasSlot = citas.filter(c => c.fecha === fechaD && slotDeCita(c.hora) === slot);
                          const esFinDeSemana = d.getDay() === 0 || d.getDay() === 6;
                          const SLOT_PX = 28;
                          return (
                            <div
                              key={i}
                              onClick={() => { setCitaEditando(null); setNuevaCita({ consultanteId: '', fecha: fechaD, hora: slot, horaFin: '', duracion: 60, notas: '' }); setShowCitaModal(true); }}
                              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const id = e.dataTransfer.getData('text/cita-id');
                                if (id) moverCita(id, fechaD, slot);
                              }}
                              style={{ height: SLOT_PX, borderRight: i < 6 ? `1px solid ${colors.border}` : 'none', padding: 0, cursor: 'pointer', background: esFinDeSemana ? '#ECECEC' : 'transparent', position: 'relative', overflow: 'visible' }}
                              title={`Clic para agendar a las ${slot} · suelta una cita aquí para moverla`}
                            >
                              {citasSlot.map(cita => {
                                const ini = minutosDeHora(cita.hora);
                                const fin = cita.horaFin ? minutosDeHora(cita.horaFin) : ini + (cita.duracion || 60);
                                const slots = Math.max(1, Math.ceil((fin - ini) / 15));
                                const altura = slots * SLOT_PX - 2;
                                return (
                                  <div
                                    key={cita.id}
                                    draggable
                                    onDragStart={(e) => { e.dataTransfer.setData('text/cita-id', cita.id); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); }}
                                    onClick={(e) => { e.stopPropagation(); abrirCita(cita); }}
                                    title="Clic para abrir o editar esta cita"
                                    style={{ position: 'absolute', top: 1, left: 2, right: 2, height: altura, background: colors.accentSoft, padding: '2px 6px', borderRadius: 3, fontSize: 10, borderLeft: `3px solid ${colors.accent}`, lineHeight: 1.3, cursor: 'pointer', zIndex: 5, overflow: 'hidden', boxSizing: 'border-box' }}
                                  >
                                    <div style={{ fontWeight: 600 }}>{cita.hora}{cita.horaFin ? `–${cita.horaFin}` : ''} · {cita.consultanteNombre}</div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vista Mensual */}
            {vistaCalendario === 'mensual' && (
              <div style={{ background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) 0.5fr 0.5fr', background: colors.primary, color: '#fff' }}>
                  {dias.map(d => (
                    <div key={d} style={{ padding: 12, textAlign: 'center', fontSize: 11, letterSpacing: 1, fontWeight: 600 }}>{d.toUpperCase()}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) 0.5fr 0.5fr' }}>
                  {diasMes.map((d, i) => {
                    if (!d) return <div key={i} style={{ minHeight: 110, background: colors.soft, borderRight: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}` }} />;
                    const esHoy = formatoFecha(d) === formatoFecha(new Date());
                    const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0);
                    const esPasado = d < inicioHoy && !esHoy;
                    const esFinDeSemana = d.getDay() === 0 || d.getDay() === 6;
                    const citasDia = citasDelDia(formatoFecha(d));
                    const fechaD = formatoFecha(d);
                    const bgDia = esHoy ? colors.accentSoft : esFinDeSemana ? '#ECECEC' : esPasado ? '#FAF5E8' : colors.cardBg;
                    return (
                      <div
                        key={i}
                        onClick={() => { setCitaEditando(null); setNuevaCita({ consultanteId: '', fecha: fechaD, hora: '', horaFin: '', duracion: 60, notas: '' }); setShowCitaModal(true); }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData('text/cita-id');
                          if (id) moverCita(id, fechaD, null);
                        }}
                        style={{ minHeight: 110, padding: 8, borderRight: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`, background: bgDia, cursor: 'pointer' }}
                        title="Clic para agendar · suelta una cita aquí para moverla a este día"
                      >
                        <div style={{ fontFamily: fontDisplay, fontSize: 16, fontWeight: 600, color: esHoy ? colors.primary : esPasado ? colors.textMuted : colors.text, opacity: esPasado ? 0.75 : 1, marginBottom: 4 }}>{d.getDate()}</div>
                        {citasDia.slice(0, 3).map(cita => (
                          <div
                            key={cita.id}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.setData('text/cita-id', cita.id); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); }}
                            onClick={(e) => { e.stopPropagation(); abrirCita(cita); }}
                            title="Clic para abrir o editar esta cita"
                            style={{ fontSize: 10, padding: '2px 6px', background: colors.primary, color: '#fff', borderRadius: 2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                          >
                            {cita.hora}{cita.horaFin ? `–${cita.horaFin}` : ''} {cita.consultanteNombre}
                          </div>
                        ))}
                        {citasDia.length > 3 && <div style={{ fontSize: 10, color: colors.textMuted }}>+{citasDia.length - 3} más</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ ALTA CONSULTANTE ============ */}
        {activeTab === 'alta' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            {/* Formulario */}
            <div>
              <h2 style={{ fontFamily: fontDisplay, fontSize: 32, margin: 0, color: colors.primary, fontWeight: 500 }}>
                {consultanteEditando ? 'Editar Consultante' : 'Nuevo Consultante'}
              </h2>
              <p style={{ color: colors.textMuted, marginTop: 4, marginBottom: 24, fontSize: 14 }}>
                Registro inicial del paciente en el sistema
              </p>

              <div style={{ background: colors.cardBg, padding: 32, borderRadius: 8, border: `1px solid ${colors.border}` }}>
                {[
                  { label: 'Nombre Completo', key: 'nombre', placeholder: 'Nombre del consultante' },
                  { label: 'Edad', key: 'edad', type: 'number', placeholder: 'Años' },
                  { label: 'Teléfono (WhatsApp)', key: 'telefono', placeholder: '+52 55 1234 5678' },
                  { label: 'Quien lo Refiere', key: 'quienRefiere', placeholder: 'Persona o profesional que refiere' }
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                      {f.label}
                    </label>
                    <input
                      type={f.type || 'text'}
                      value={nuevoConsultante[f.key]}
                      onChange={(e) => setNuevoConsultante({ ...nuevoConsultante, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      style={{
                        width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`,
                        borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg,
                        outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Motivo de Consulta
                  </label>
                  <textarea
                    value={nuevoConsultante.motivoConsulta}
                    onChange={(e) => setNuevoConsultante({ ...nuevoConsultante, motivoConsulta: e.target.value })}
                    placeholder="¿Qué trae al consultante a terapia?"
                    rows={4}
                    style={{
                      width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`,
                      borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg,
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    onClick={guardarConsultante}
                    style={{
                      flex: 1, background: colors.primary, color: '#fff', border: 'none',
                      padding: '14px 24px', borderRadius: 4, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    <Save size={16} /> {consultanteEditando ? 'Actualizar' : 'Guardar Consultante'}
                  </button>
                  {consultanteEditando && (
                    <button
                      onClick={() => {
                        setConsultanteEditando(null);
                        setNuevoConsultante({ nombre: '', edad: '', telefono: '', motivoConsulta: '', quienRefiere: '' });
                      }}
                      style={{ background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`, padding: '14px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de consultantes */}
            <div>
              <h2 style={{ fontFamily: fontDisplay, fontSize: 32, margin: 0, color: colors.primary, fontWeight: 500 }}>
                Consultantes Activos
              </h2>
              <p style={{ color: colors.textMuted, marginTop: 4, marginBottom: 24, fontSize: 14 }}>
                {consultantes.length} {consultantes.length === 1 ? 'consultante registrado' : 'consultantes registrados'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 700, overflowY: 'auto' }}>
                {consultantes.length === 0 ? (
                  <div style={{ background: colors.cardBg, padding: 40, textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: 8, color: colors.textMuted }}>
                    <User size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p>Aún no hay consultantes registrados</p>
                  </div>
                ) : (
                  consultantes.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setConsultanteVisualizando(c)}
                      title="Clic para abrir la ficha"
                      style={{ background: colors.cardBg, padding: 20, borderRadius: 8, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${colors.accent}`, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: fontDisplay, fontSize: 20, color: colors.primary, fontWeight: 600 }}>{c.nombre}</div>
                          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>{c.edad} años · Refiere: {c.quienRefiere || 'N/E'}</div>
                          {c.motivoConsulta && (
                            <div style={{ fontSize: 13, fontFamily: fontBody, fontStyle: 'italic', color: colors.text, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${colors.border}` }}>
                              "{c.motivoConsulta.substring(0, 120)}{c.motivoConsulta.length > 120 ? '...' : ''}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${colors.border}` }}>
                        {c.telefono && (
                          <a
                            href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ background: '#25D366', color: '#fff', padding: '6px 12px', borderRadius: 4, fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <MessageCircle size={12} /> WhatsApp
                          </a>
                        )}
                        {c.telefono && (
                          <a
                            href={`tel:${c.telefono}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ background: colors.soft, color: colors.text, padding: '6px 12px', borderRadius: 4, fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <Phone size={12} /> Llamar
                          </a>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); editarConsultante(c); }} style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}>
                          Editar
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); eliminarConsultante(c.id); }} style={{ background: 'transparent', border: `1px solid ${colors.danger}`, color: colors.danger, padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ PREPARACIÓN DE SESIÓN (CHAT IA) ============ */}
        {activeTab === 'preparacion' && (
          <div>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h2 style={{ fontFamily: fontDisplay, fontSize: 32, margin: 0, color: colors.primary, fontWeight: 500 }}>
                  Preparando mi sesión
                </h2>
                <p style={{ color: colors.textMuted, marginTop: 4, fontSize: 14 }}>
                  Consejos específicos basados en el historial completo del consultante
                </p>
              </div>
              {prepMensajes.length > 0 && (
                <button onClick={limpiarChat} style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: '10px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: colors.textMuted }}>
                  <RefreshCw size={12} /> Nueva conversación
                </button>
              )}
            </div>

            {/* Selector de consultante */}
            <div style={{ background: colors.cardBg, padding: 24, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 8, fontWeight: 600 }}>
                Consultante para esta preparación
              </label>
              <select
                value={prepConsultanteId}
                onChange={(e) => {
                  setPrepConsultanteId(e.target.value);
                  if (e.target.value !== prepConsultanteId) setPrepMensajes([]);
                }}
                style={{ width: '100%', padding: '14px 16px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 15, fontFamily: fontBody, background: colors.bg, outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
              >
                <option value="">— Seleccionar consultante —</option>
                {consultantes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.edad} años)</option>
                ))}
              </select>
              {consultantes.length === 0 && (
                <div style={{ fontSize: 12, color: colors.danger, marginTop: 8 }}>
                  ⚠ Primero da de alta un consultante en la pestaña anterior
                </div>
              )}
              {prepConsultanteId && (() => {
                const c = consultantes.find(x => x.id === prepConsultanteId);
                const numNotas = notas.filter(n => n.consultanteId === prepConsultanteId).length;
                const numReportes = sesiones.filter(s => s.consultanteId === prepConsultanteId).length;
                return (
                  <div style={{ marginTop: 14, padding: 14, background: colors.soft, borderLeft: `3px solid ${colors.accent}`, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: fontDisplay, fontSize: 17, color: colors.primary, fontWeight: 600 }}>{c?.nombre}</div>
                      <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                        {c?.edad} años · Motivo: {c?.motivoConsulta?.substring(0, 80) || 'No registrado'}{c?.motivoConsulta?.length > 80 ? '...' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ background: colors.cardBg, padding: '6px 12px', borderRadius: 4, fontSize: 11, color: colors.text }}>
                        <strong style={{ color: colors.primary }}>{numNotas}</strong> notas
                      </div>
                      <div style={{ background: colors.cardBg, padding: '6px 12px', borderRadius: 4, fontSize: 11, color: colors.text }}>
                        <strong style={{ color: colors.primary }}>{numReportes}</strong> reportes
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Chat */}
            <div style={{ background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 600 }}>

              {/* Header del chat */}
              <div style={{ padding: '20px 28px', background: colors.primary, color: '#fff', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `2px solid ${colors.accent}` }}>
                <div style={{ background: colors.accent, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={20} color={colors.primary} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fontDisplay, fontSize: 18, fontWeight: 600 }}>Algunas ideas que pueden ayudar</div>
                  <div style={{ fontSize: 12, color: colors.accentSoft, fontStyle: 'italic' }}>
                    Basado en las notas y reportes de sesión del consultante seleccionado
                  </div>
                </div>
                {prepMensajes.length > 0 && (
                  <button
                    onClick={limpiarChat}
                    title="Borrar toda la conversación actual"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', padding: '8px 12px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                  >
                    <Trash2 size={14} /> Limpiar conversaciones
                  </button>
                )}
                <button
                  onClick={() => { setApiKeyInput(apiKey); setShowApiKeyModal(true); }}
                  title={apiKey ? 'API Key configurada — clic para cambiar' : 'Configurar API Key'}
                  style={{ background: apiKey ? 'rgba(255,255,255,0.12)' : colors.danger, border: `1px solid ${apiKey ? 'rgba(255,255,255,0.25)' : colors.danger}`, color: '#fff', padding: '8px 12px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                >
                  <Key size={14} /> {apiKey ? 'API Key' : 'Configurar key'}
                </button>
              </div>

              {/* Mensajes */}
              <div style={{ flex: 1, padding: 28, overflowY: 'auto', maxHeight: 500, background: colors.bg }}>
                {prepMensajes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: colors.textMuted }}>
                    <Sparkles size={40} style={{ opacity: 0.4, marginBottom: 16, color: colors.accent }} />
                    <div style={{ fontFamily: fontDisplay, fontSize: 22, color: colors.primary, marginBottom: 8 }}>
                      ¿En qué puedo apoyarte para esta sesión?
                    </div>
                    <div style={{ fontSize: 13, maxWidth: 480, margin: '0 auto', lineHeight: 1.6, fontFamily: fontBody, fontStyle: 'italic' }}>
                      Selecciona un consultante arriba y pregunta libremente. Puedo ayudarte a identificar técnicas logoterapéuticas pertinentes, hipótesis a explorar, hilos conductores entre sesiones, ejercicios para trabajar el sentido, o cualquier reflexión clínica.
                    </div>

                    {prepConsultanteId && (
                      <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
                        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>Sugerencias rápidas</div>
                        {[
                          '¿Qué técnicas frankleanas son pertinentes para la próxima sesión?',
                          'Identifica patrones que has detectado a lo largo de las sesiones previas',
                          '¿Qué ejercicio de búsqueda de sentido recomendarías para esta consulta?',
                          'Resume el avance terapéutico hasta ahora y qué falta trabajar'
                        ].map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => setPrepInput(sug)}
                            style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, padding: '10px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontFamily: fontBody, color: colors.text, textAlign: 'left' }}
                          >
                            "{sug}"
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {prepMensajes.map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '80%',
                          padding: '14px 18px',
                          borderRadius: 8,
                          background: m.role === 'user' ? colors.primary : colors.cardBg,
                          color: m.role === 'user' ? '#fff' : colors.text,
                          border: m.role === 'user' ? 'none' : `1px solid ${colors.border}`,
                          borderLeft: m.role === 'assistant' ? `3px solid ${colors.accent}` : 'none',
                          fontSize: 14,
                          fontFamily: fontBody,
                          lineHeight: 1.7,
                          whiteSpace: 'pre-wrap'
                        }}>
                          {m.role === 'assistant' && (
                            <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.accent, marginBottom: 8, fontWeight: 700, fontFamily: fontUI }}>
                              Algunas ideas que pueden ayudar
                            </div>
                          )}
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {prepCargando && (
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ padding: '14px 18px', borderRadius: 8, background: colors.cardBg, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${colors.accent}`, fontSize: 13, color: colors.textMuted, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <span style={{ width: 6, height: 6, background: colors.accent, borderRadius: '50%', animation: 'pulse 1.4s ease-in-out infinite' }}></span>
                            <span style={{ width: 6, height: 6, background: colors.accent, borderRadius: '50%', animation: 'pulse 1.4s ease-in-out 0.2s infinite' }}></span>
                            <span style={{ width: 6, height: 6, background: colors.accent, borderRadius: '50%', animation: 'pulse 1.4s ease-in-out 0.4s infinite' }}></span>
                          </div>
                          Reflexionando sobre el caso...
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ padding: 20, borderTop: `1px solid ${colors.border}`, background: colors.cardBg }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <textarea
                    value={prepInput}
                    onChange={(e) => setPrepInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        enviarMensajeChat();
                      }
                    }}
                    placeholder={prepConsultanteId ? "Pregunta libremente sobre la preparación de la sesión..." : "Primero selecciona un consultante arriba"}
                    disabled={!prepConsultanteId || prepCargando}
                    rows={2}
                    style={{ flex: 1, padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: prepConsultanteId ? colors.bg : colors.soft, outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
                  />
                  <button
                    onClick={enviarMensajeChat}
                    disabled={!prepConsultanteId || !prepInput.trim() || prepCargando}
                    style={{
                      background: (!prepConsultanteId || !prepInput.trim() || prepCargando) ? colors.border : colors.primary,
                      color: '#fff',
                      border: 'none',
                      padding: '14px 22px',
                      borderRadius: 4,
                      cursor: (!prepConsultanteId || !prepInput.trim() || prepCargando) ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      height: 56
                    }}
                  >
                    <Send size={14} /> Enviar
                  </button>
                </div>
                <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' }}>
                  Enter para enviar · Shift+Enter para nueva línea · El supervisor tiene acceso al historial completo del consultante seleccionado
                </div>
              </div>

              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 0.3; transform: scale(0.8); }
                  50% { opacity: 1; transform: scale(1.2); }
                }
              `}</style>
            </div>
          </div>
        )}

        {/* ============ NOTAS DE SESIÓN ============ */}
        {activeTab === 'notas' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: fontDisplay, fontSize: 32, margin: 0, color: colors.primary, fontWeight: 500 }}>
                {notaEditando ? 'Editar Nota de Sesión' : 'Notas de Sesión'}
              </h2>
              <p style={{ color: colors.textMuted, marginTop: 4, fontSize: 14 }}>
                Bitácora rápida durante la sesión · Estas notas alimentan automáticamente el Reporte formal
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32 }}>

              {/* COLUMNA IZQUIERDA: Captura de notas */}
              <div>
                <div style={{ background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>

                  {/* Encabezado de sección */}
                  <div style={{ padding: '24px 28px', background: colors.soft, borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>
                      Identificación de la Sesión
                    </div>
                    <h3 style={{ fontFamily: fontDisplay, fontSize: 20, margin: 0, color: colors.primary, fontWeight: 500 }}>
                      Datos básicos
                    </h3>
                  </div>

                  <div style={{ padding: 28 }}>
                    {/* Consultante */}
                    <div style={{ marginBottom: 18 }}>
                      <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                        Consultante
                      </label>
                      <select
                        value={notaActual.consultanteId}
                        onChange={(e) => setNotaActual({ ...notaActual, consultanteId: e.target.value })}
                        style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
                      >
                        <option value="">— Seleccionar consultante —</option>
                        {consultantes.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre} ({c.edad} años)</option>
                        ))}
                      </select>
                      {consultantes.length === 0 && (
                        <div style={{ fontSize: 12, color: colors.danger, marginTop: 6 }}>
                          ⚠ Primero da de alta un consultante
                        </div>
                      )}
                    </div>

                    {/* Fecha */}
                    <div style={{ marginBottom: 18 }}>
                      <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={notaActual.fecha}
                        onChange={(e) => setNotaActual({ ...notaActual, fecha: e.target.value })}
                        style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Consulta X de Y */}
                    <div style={{ marginBottom: 24 }}>
                      <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                        Consulta
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 4, padding: '8px 14px' }}>
                        <span style={{ fontFamily: fontDisplay, fontSize: 16, color: colors.primary, fontWeight: 600, letterSpacing: 1 }}>CONSULTA</span>
                        <input
                          type="number"
                          value={notaActual.sesionNum}
                          onChange={(e) => setNotaActual({ ...notaActual, sesionNum: e.target.value })}
                          placeholder="5"
                          style={{ width: 70, padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 16, fontFamily: fontDisplay, fontWeight: 600, color: colors.primary, background: '#fff', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                        />
                        <span style={{ fontFamily: fontDisplay, fontSize: 16, color: colors.primary, fontWeight: 600, letterSpacing: 1 }}>DE</span>
                        <input
                          type="number"
                          value={notaActual.consultaDe}
                          onChange={(e) => setNotaActual({ ...notaActual, consultaDe: e.target.value })}
                          placeholder="10"
                          style={{ width: 70, padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 16, fontFamily: fontDisplay, fontWeight: 600, color: colors.primary, background: '#fff', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Encabezado Motivo y Tema */}
                  <div style={{ padding: '24px 28px', background: colors.soft, borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>
                      Motivo y tema
                    </div>
                    <h3 style={{ fontFamily: fontDisplay, fontSize: 20, margin: 0, color: colors.primary, fontWeight: 500 }}>
                      Motivo y Tema de Consulta
                    </h3>
                  </div>

                  <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                        Motivo de Consulta
                      </label>
                      <input
                        type="text"
                        value={consultantes.find(c => c.id === notaActual.consultanteId)?.motivoConsulta || ''}
                        readOnly
                        placeholder="Se toma del registro del consultante (pestaña Nuevo Consultante)"
                        style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.soft, outline: 'none', boxSizing: 'border-box', color: colors.primary }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                        Tema de Consulta
                      </label>
                      <textarea
                        value={notaActual.temaConsulta}
                        onChange={(e) => setNotaActual({ ...notaActual, temaConsulta: e.target.value })}
                        placeholder="Tema central trabajado en la sesión..."
                        rows={4}
                        style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Encabezado de notas */}
                  <div style={{ padding: '24px 28px', background: colors.soft, borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>
                        Bitácora abierta
                      </div>
                      <h3 style={{ fontFamily: fontDisplay, fontSize: 20, margin: 0, color: colors.primary, fontWeight: 500 }}>
                        Notas de la sesión
                      </h3>
                    </div>
                    <button
                      onClick={toggleDictado}
                      disabled={!dictadoSoportado}
                      title={
                        !dictadoSoportado
                          ? 'Tu navegador no soporta dictado por voz. Usa Chrome, Edge o Safari.'
                          : dictando ? 'Detener dictado' : 'Dictar por voz'
                      }
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px',
                        background: dictando ? colors.danger : colors.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: dictadoSoportado ? 'pointer' : 'not-allowed',
                        opacity: dictadoSoportado ? 1 : 0.5,
                        fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                        fontFamily: fontUI,
                        whiteSpace: 'nowrap',
                        boxShadow: dictando ? `0 0 0 4px ${colors.danger}33` : 'none',
                        transition: 'background 0.2s, box-shadow 0.2s'
                      }}
                    >
                      {dictando ? <MicOff size={16} /> : <Mic size={16} />}
                      {dictando ? 'Detener' : 'Dictar'}
                    </button>
                  </div>
                  {dictando && (
                    <div style={{ padding: '8px 28px', background: '#FFF6F6', borderBottom: `1px solid ${colors.border}`, fontSize: 12, color: colors.danger, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, marginTop: 4, flexShrink: 0, borderRadius: '50%', background: colors.danger, animation: 'pulse 1.2s ease-in-out infinite' }} />
                      <span>
                        {dictadoAviso || 'Escuchando… habla con claridad. El texto se irá agregando a las notas. Pulsa Detener cuando termines.'}
                      </span>
                    </div>
                  )}

                  <div style={{ padding: 28 }}>
                    <textarea
                      value={notaActual.contenido}
                      onChange={(e) => setNotaActual({ ...notaActual, contenido: e.target.value })}
                      placeholder="Escribe libremente durante la sesión: observaciones, frases del consultante, intervenciones realizadas, hipótesis, temas que emergen, lenguaje no verbal, hallazgos relevantes, ejercicios aplicados...

Esta bitácora se transferirá automáticamente al Reporte formal cuando estés lista."
                      rows={16}
                      style={{ width: '100%', padding: '16px 18px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7 }}
                    />
                    <div style={{ marginTop: 8, fontSize: 11, color: colors.textMuted, fontStyle: 'italic', textAlign: 'right' }}>
                      {notaActual.contenido.length} caracteres · {notaActual.contenido.split(/\s+/).filter(w => w).length} palabras
                    </div>
                  </div>

                  {/* Botones */}
                  <div style={{ padding: 28, background: colors.soft, borderTop: `2px solid ${colors.accent}`, display: 'flex', gap: 12 }}>
                    <button
                      onClick={guardarNota}
                      style={{
                        flex: 1, background: colors.primary, color: '#fff', border: 'none',
                        padding: '16px 24px', borderRadius: 4, cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                      }}
                    >
                      <Save size={16} /> {notaEditando ? 'Actualizar Nota' : 'Guardar Nota'}
                    </button>
                    {notaEditando && (
                      <button
                        onClick={() => {
                          setNotaEditando(null);
                          setNotaActual({
                            consultanteId: '', sesionNum: '', consultaDe: '',
                            fecha: new Date().toISOString().split('T')[0],
                            motivoConsulta: '', temaConsulta: '',
                            contenido: ''
                          });
                        }}
                        style={{ background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`, padding: '16px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: Notas guardadas */}
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontFamily: fontDisplay, fontSize: 22, margin: 0, color: colors.primary, fontWeight: 500 }}>
                      Notas Archivadas
                    </h3>
                    <p style={{ color: colors.textMuted, marginTop: 2, fontSize: 13 }}>
                      {notas.length} {notas.length === 1 ? 'nota guardada' : 'notas guardadas'}
                    </p>
                  </div>
                </div>

                {/* Vista: grilla de consultantes (sin selección) o notas del consultante seleccionado */}
                {!filtroNotasConsultante ? (
                  consultantes.length === 0 ? (
                    <div style={{ background: colors.cardBg, padding: 40, textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: 8, color: colors.textMuted }}>
                      <User size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                      <p style={{ fontSize: 13 }}>Aún no hay consultantes registrados</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, maxHeight: 800, overflowY: 'auto', paddingRight: 4 }}>
                      {consultantes.map(c => {
                        const countNotas = notas.filter(n => n.consultanteId === c.id).length;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setFiltroNotasConsultante(c.id)}
                            style={{ background: colors.cardBg, padding: 18, borderRadius: 8, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${colors.accent}`, cursor: 'pointer', textAlign: 'left', fontFamily: fontBody, display: 'flex', flexDirection: 'column', gap: 8, transition: 'transform 0.1s, box-shadow 0.1s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: colors.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fontDisplay, fontSize: 15, fontWeight: 600 }}>
                                {c.nombre.trim().charAt(0).toUpperCase()}
                              </div>
                              <div style={{ fontFamily: fontDisplay, fontSize: 15, color: colors.primary, fontWeight: 600, lineHeight: 1.2 }}>
                                {c.nombre}
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <StickyNote size={11} />
                              {countNotas} {countNotas === 1 ? 'nota' : 'notas'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                <>
                <button
                  onClick={() => setFiltroNotasConsultante('')}
                  style={{ width: '100%', padding: '10px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 12, fontFamily: fontBody, background: 'transparent', color: colors.text, outline: 'none', cursor: 'pointer', marginBottom: 16, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ChevronLeft size={14} /> Volver a consultantes
                </button>

                {/* Lista */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 800, overflowY: 'auto', paddingRight: 4 }}>
                  {notas.filter(n => n.consultanteId === filtroNotasConsultante).length === 0 ? (
                    <div style={{ background: colors.cardBg, padding: 40, textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: 8, color: colors.textMuted }}>
                      <StickyNote size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                      <p style={{ fontSize: 13 }}>Sin notas para este consultante</p>
                    </div>
                  ) : (
                    notas
                      .filter(n => n.consultanteId === filtroNotasConsultante)
                      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                      .map(n => (
                        <div key={n.id} style={{ background: colors.cardBg, padding: 16, borderRadius: 6, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${colors.accent}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontFamily: fontDisplay, fontSize: 16, color: colors.primary, fontWeight: 600 }}>
                                {n.consultanteNombre}
                              </div>
                              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                                Consulta {n.sesionNum || '?'} de {n.consultaDe || '?'} · {new Date(n.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                          </div>
                          {n.contenido && (
                            <div style={{ fontSize: 12, fontFamily: fontBody, fontStyle: 'italic', color: colors.text, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${colors.border}`, lineHeight: 1.5, maxHeight: 80, overflow: 'hidden', position: 'relative' }}>
                              "{n.contenido.substring(0, 180)}{n.contenido.length > 180 ? '...' : ''}"
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${colors.border}` }}>
                            <button
                              onClick={() => transferirNotaAReporte(n)}
                              style={{ flex: 1, background: colors.primary, color: '#fff', border: 'none', padding: '8px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            >
                              <ArrowRight size={11} /> Pasar a Reporte
                            </button>
                            <button onClick={() => editarNota(n)} style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: '8px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                              Editar
                            </button>
                            <button onClick={() => eliminarNota(n.id)} style={{ background: 'transparent', border: `1px solid ${colors.danger}`, color: colors.danger, padding: '8px 10px', borderRadius: 4, cursor: 'pointer' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
                </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ REPORTE SESIÓN ============ */}
        {activeTab === 'reporte' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
              <div>
                <h2 style={{ fontFamily: fontDisplay, fontSize: 32, margin: 0, color: colors.primary, fontWeight: 500 }}>
                  {reporteEditando ? 'Editar Reporte' : 'Reporte de Sesión de Logoterapia'}
                </h2>
                <p style={{ color: colors.textMuted, marginTop: 4, fontSize: 14 }}>Bitácora clínica del proceso terapéutico</p>
              </div>
              {reporteEditando && (
                <button
                  onClick={() => {
                    setReporteEditando(null);
                    setReporteSesion({
                      orientador: ORIENTADOR_NOMBRE, consultanteId: '', sesionNum: '', consultaDe: '', totalSesiones: '',
                      fecha: new Date().toISOString().split('T')[0],
                      motivoConsulta: '', temaConsulta: '', intervencion: '', autoObservacion: '', tiempoSesion: ''
                    });
                  }}
                  style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: '10px 18px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                >
                  Nuevo Reporte
                </button>
              )}
            </div>

            <div style={{ background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>

              {/* SECCIÓN 1 */}
              <div style={{ padding: '28px 32px', borderBottom: `1px solid ${colors.border}`, background: colors.soft }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>Sección 1</div>
                <h3 style={{ fontFamily: fontDisplay, fontSize: 22, margin: 0, color: colors.primary, fontWeight: 500 }}>Datos Generales</h3>
              </div>
              <div style={{ padding: 32, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Orientador Logoterapéutico
                  </label>
                  <input
                    type="text"
                    value={ORIENTADOR_NOMBRE}
                    readOnly
                    style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.soft, outline: 'none', boxSizing: 'border-box', color: colors.primary, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Consultante
                  </label>
                  <select
                    value={reporteSesion.consultanteId}
                    onChange={(e) => setReporteSesion({ ...reporteSesion, consultanteId: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
                  >
                    <option value="">— Seleccionar consultante —</option>
                    {consultantes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.edad} años)</option>
                    ))}
                  </select>
                  {consultantes.length === 0 && (
                    <div style={{ fontSize: 12, color: colors.danger, marginTop: 6 }}>
                      ⚠ Primero da de alta un consultante en la pestaña anterior
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Edad
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={consultantes.find(c => c.id === reporteSesion.consultanteId)?.edad || ''}
                    placeholder="Se completa al seleccionar consultante"
                    style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, background: colors.soft, outline: 'none', boxSizing: 'border-box', color: colors.textMuted }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={reporteSesion.fecha}
                    onChange={(e) => setReporteSesion({ ...reporteSesion, fecha: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Consulta
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 4, padding: '8px 14px' }}>
                    <span style={{ fontFamily: fontDisplay, fontSize: 16, color: colors.primary, fontWeight: 600, letterSpacing: 1 }}>CONSULTA</span>
                    <input
                      type="number"
                      value={reporteSesion.sesionNum}
                      onChange={(e) => setReporteSesion({ ...reporteSesion, sesionNum: e.target.value })}
                      placeholder="5"
                      style={{ width: 70, padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 16, fontFamily: fontDisplay, fontWeight: 600, color: colors.primary, background: '#fff', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontFamily: fontDisplay, fontSize: 16, color: colors.primary, fontWeight: 600, letterSpacing: 1 }}>DE</span>
                    <input
                      type="number"
                      value={reporteSesion.consultaDe}
                      onChange={(e) => setReporteSesion({ ...reporteSesion, consultaDe: e.target.value })}
                      placeholder="10"
                      style={{ width: 70, padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 16, fontFamily: fontDisplay, fontWeight: 600, color: colors.primary, background: '#fff', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginLeft: 'auto' }}>
                      {reporteSesion.sesionNum && reporteSesion.consultaDe ? `Consulta ${reporteSesion.sesionNum} de ${reporteSesion.consultaDe}` : ''}
                    </span>
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Total de Sesiones
                  </label>
                  <input
                    type="number"
                    value={reporteSesion.totalSesiones}
                    onChange={(e) => setReporteSesion({ ...reporteSesion, totalSesiones: e.target.value })}
                    placeholder="Ingresa el total de sesiones"
                    style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: '#fff', outline: 'none', boxSizing: 'border-box', color: colors.primary, fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* SECCIÓN 2 */}
              <div style={{ padding: '28px 32px', borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`, background: colors.soft }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>Sección 2</div>
                <h3 style={{ fontFamily: fontDisplay, fontSize: 22, margin: 0, color: colors.primary, fontWeight: 500 }}>Motivo y Tema de Consulta</h3>
              </div>
              <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Motivo de Consulta
                  </label>
                  <input
                    type="text"
                    value={consultantes.find(c => c.id === reporteSesion.consultanteId)?.motivoConsulta || ''}
                    readOnly
                    placeholder="Se toma del registro del consultante (pestaña Nuevo Consultante)"
                    style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.soft, outline: 'none', boxSizing: 'border-box', color: colors.primary }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Tema de Consulta
                  </label>
                  <textarea
                    value={reporteSesion.temaConsulta}
                    onChange={(e) => setReporteSesion({ ...reporteSesion, temaConsulta: e.target.value })}
                    placeholder="Tema central trabajado en la sesión..."
                    rows={4}
                    style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* SECCIÓN 3 */}
              <div style={{ padding: '28px 32px', borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`, background: colors.soft, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>Sección 3</div>
                  <h3 style={{ fontFamily: fontDisplay, fontSize: 22, margin: 0, color: colors.primary, fontWeight: 500 }}>Intervención</h3>
                </div>
                <button
                  onClick={generarReporteConIA}
                  disabled={generandoReporteIA || !reporteSesion.consultanteId}
                  title="Generar reporte automático a partir de las notas de la sesión"
                  style={{
                    background: (generandoReporteIA || !reporteSesion.consultanteId) ? colors.border : colors.primary,
                    color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 4,
                    cursor: (generandoReporteIA || !reporteSesion.consultanteId) ? 'not-allowed' : 'pointer',
                    fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}
                >
                  {generandoReporteIA ? <RefreshCw size={14} /> : <Sparkles size={14} />}
                  {generandoReporteIA ? 'Generando…' : 'Generar con IA'}
                </button>
              </div>
              <div style={{ padding: 32 }}>
                <textarea
                  value={reporteSesion.intervencion}
                  onChange={(e) => setReporteSesion({ ...reporteSesion, intervencion: e.target.value })}
                  placeholder="Descripción detallada de la intervención logoterapéutica realizada: técnicas aplicadas, diálogo socrático, derreflexión, intención paradójica, ejercicios de búsqueda de sentido..."
                  rows={10}
                  style={{ width: '100%', padding: '14px 16px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
                />
              </div>

              {/* SECCIÓN 4 */}
              <div style={{ padding: '28px 32px', borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`, background: colors.soft }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>Sección 4</div>
                <h3 style={{ fontFamily: fontDisplay, fontSize: 22, margin: 0, color: colors.primary, fontWeight: 500 }}>Cierre y Auto-Observación</h3>
              </div>
              <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Auto-Observación del Orientador
                  </label>
                  <textarea
                    value={reporteSesion.autoObservacion}
                    onChange={(e) => setReporteSesion({ ...reporteSesion, autoObservacion: e.target.value })}
                    placeholder="Reflexión personal del orientador: contratransferencia, aprendizajes, hipótesis a explorar, supervisión sugerida..."
                    rows={5}
                    style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ width: '50%' }}>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>
                    Tiempo de la Sesión
                  </label>
                  <input
                    type="text"
                    value={reporteSesion.tiempoSesion}
                    onChange={(e) => setReporteSesion({ ...reporteSesion, tiempoSesion: e.target.value })}
                    placeholder="Ej: 50 minutos"
                    style={{ width: '100%', padding: '12px 14px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* GUARDAR */}
              <div style={{ padding: 32, background: colors.soft, borderTop: `2px solid ${colors.accent}` }}>
                <button
                  onClick={guardarReporte}
                  style={{
                    width: '100%', background: colors.primary, color: '#fff', border: 'none',
                    padding: '18px 24px', borderRadius: 4, cursor: 'pointer',
                    fontSize: 14, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                  }}
                >
                  <Save size={18} /> Guardar Reporte y Exportar a PDF
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: colors.textMuted, marginTop: 12, fontStyle: 'italic' }}>
                  El reporte queda almacenado en el Archivo Clínico y se abre en una ventana lista para imprimir o guardar como PDF
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============ ARCHIVO CLÍNICO ============ */}
        {activeTab === 'historial' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: fontDisplay, fontSize: 32, margin: 0, color: colors.primary, fontWeight: 500 }}>
                Archivo Clínico
              </h2>
              <p style={{ color: colors.textMuted, marginTop: 4, fontSize: 14 }}>
                {sesiones.length + notas.length} {(sesiones.length + notas.length) === 1 ? 'registro archivado' : 'registros archivados'} · Consulta histórica del proceso terapéutico
              </p>
            </div>

            {/* Barra superior: buscador + (si hay consultante seleccionado) botón volver */}
            <div style={{ background: colors.cardBg, padding: 20, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 20, display: 'grid', gridTemplateColumns: filtroConsultante ? 'auto 2fr' : '1fr', gap: 16, alignItems: 'center' }}>
              {filtroConsultante && (
                <button
                  onClick={() => {
                    if (vistaArchivo) { setVistaArchivo(null); }
                    else { setFiltroConsultante(''); setBusqueda(''); }
                  }}
                  style={{ padding: '12px 16px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 13, fontFamily: fontBody, background: 'transparent', color: colors.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ChevronLeft size={14} /> Volver
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: 14, color: colors.textMuted }} />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, tema, motivo o intervención..."
                  style={{ width: '100%', padding: '12px 14px 12px 40px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Vista: grilla de consultantes o lista de reportes */}
            {!filtroConsultante && !busqueda ? (
              consultantes.length === 0 ? (
                <div style={{ background: colors.cardBg, padding: 60, textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: 8, color: colors.textMuted }}>
                  <User size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p>Aún no hay consultantes registrados</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                  {consultantes.map(c => {
                    const countReportes = sesiones.filter(s => s.consultanteId === c.id).length;
                    const countNotas = notas.filter(n => n.consultanteId === c.id).length;
                    const total = countReportes + countNotas;
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setFiltroConsultante(c.id); setVistaArchivo(null); }}
                        style={{ background: colors.cardBg, padding: 22, borderRadius: 8, border: `1px solid ${colors.border}`, borderLeft: `4px solid ${colors.primary}`, cursor: 'pointer', textAlign: 'left', fontFamily: fontBody, display: 'flex', flexDirection: 'column', gap: 10, transition: 'transform 0.1s, box-shadow 0.1s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: colors.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fontDisplay, fontSize: 18, fontWeight: 600 }}>
                            {c.nombre.trim().charAt(0).toUpperCase()}
                          </div>
                          <div style={{ fontFamily: fontDisplay, fontSize: 17, color: colors.primary, fontWeight: 600, lineHeight: 1.2 }}>
                            {c.nombre}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Archive size={12} />
                          {total} {total === 1 ? 'registro' : 'registros'} · {countReportes} {countReportes === 1 ? 'reporte' : 'reportes'} · {countNotas} {countNotas === 1 ? 'nota' : 'notas'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (filtroConsultante && !busqueda && !vistaArchivo) ? (
              (() => {
                const consultanteSel = consultantes.find(c => c.id === filtroConsultante);
                const countReportes = sesiones.filter(s => s.consultanteId === filtroConsultante).length;
                const countNotas = notas.filter(n => n.consultanteId === filtroConsultante).length;
                return (
                  <div>
                    <h3 style={{ fontFamily: fontDisplay, fontSize: 24, color: colors.primary, fontWeight: 500, textAlign: 'center', marginTop: 24, marginBottom: 8 }}>
                      Expediente de {consultanteSel?.nombre || 'consultante'}
                    </h3>
                    <p style={{ textAlign: 'center', color: colors.textMuted, fontSize: 14, marginTop: 0, marginBottom: 32 }}>
                      ¿Qué quieres abrir?
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 800, margin: '0 auto' }}>
                      <button
                        onClick={() => setVistaArchivo('notas')}
                        style={{ background: colors.cardBg, padding: '48px 32px', borderRadius: 12, border: `2px solid ${colors.border}`, borderLeft: `6px solid ${colors.accent}`, cursor: 'pointer', textAlign: 'center', fontFamily: fontBody, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, transition: 'transform 0.1s, box-shadow 0.1s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <StickyNote size={56} color={colors.accent} />
                        <div style={{ fontFamily: fontDisplay, fontSize: 26, color: colors.primary, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                          Notas
                        </div>
                        <div style={{ fontSize: 13, color: colors.textMuted }}>
                          {countNotas} {countNotas === 1 ? 'nota archivada' : 'notas archivadas'}
                        </div>
                      </button>
                      <button
                        onClick={() => setVistaArchivo('reportes')}
                        style={{ background: colors.cardBg, padding: '48px 32px', borderRadius: 12, border: `2px solid ${colors.border}`, borderLeft: `6px solid ${colors.primary}`, cursor: 'pointer', textAlign: 'center', fontFamily: fontBody, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, transition: 'transform 0.1s, box-shadow 0.1s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <FileText size={56} color={colors.primary} />
                        <div style={{ fontFamily: fontDisplay, fontSize: 26, color: colors.primary, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                          Reportes Enviados
                        </div>
                        <div style={{ fontSize: 13, color: colors.textMuted }}>
                          {countReportes} {countReportes === 1 ? 'reporte archivado' : 'reportes archivados'}
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (() => {
              const incluirReportes = !filtroConsultante || busqueda || vistaArchivo === 'reportes';
              const incluirNotas = filtroConsultante && !busqueda && vistaArchivo === 'notas';
              const archivoItems = [
                ...(incluirReportes ? reportesFiltrados.map(r => ({ ...r, _tipo: 'reporte' })) : []),
                ...(incluirNotas
                  ? notas
                      .filter(n => n.consultanteId === filtroConsultante)
                      .map(n => ({ ...n, _tipo: 'nota' }))
                  : [])
              ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
              return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {archivoItems.length === 0 ? (
                <div style={{ background: colors.cardBg, padding: 60, textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: 8, color: colors.textMuted }}>
                  <Archive size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p>{(sesiones.length + notas.length) === 0 ? 'Aún no hay registros archivados' : 'Sin resultados para este filtro'}</p>
                </div>
              ) : (
                archivoItems.map(item => item._tipo === 'reporte' ? (
                  <div key={`r_${item.id}`} style={{ background: colors.cardBg, padding: 24, borderRadius: 8, border: `1px solid ${colors.border}`, borderLeft: `4px solid ${colors.primary}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, background: colors.primary, color: '#fff', padding: '3px 8px', borderRadius: 3 }}>Reporte</span>
                        </div>
                        <div style={{ fontFamily: fontDisplay, fontSize: 22, color: colors.primary, fontWeight: 600 }}>
                          {item.consultanteNombre || 'Sin consultante'}
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: colors.textMuted }}>
                          <span><Hash size={11} style={{ display: 'inline', marginRight: 4 }} />Consulta {item.sesionNum} de {item.consultaDe}</span>
                          <span><Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />{new Date(item.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          {item.tiempoSesion && <span><Clock size={11} style={{ display: 'inline', marginRight: 4 }} />{item.tiempoSesion}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setReporteVisualizando(item)} style={{ background: colors.soft, border: 'none', padding: '8px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Eye size={12} /> Ver
                        </button>
                        <button onClick={() => exportarReporte(item)} style={{ background: colors.accentSoft, border: 'none', padding: '8px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Download size={12} /> Exportar
                        </button>
                        <button onClick={() => cargarReporte(item)} style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: '8px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                          Editar
                        </button>
                        <button onClick={() => eliminarReporte(item.id)} style={{ background: 'transparent', border: `1px solid ${colors.danger}`, color: colors.danger, padding: '8px 12px', borderRadius: 4, cursor: 'pointer' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {item.temaConsulta && (
                      <div style={{ paddingTop: 12, borderTop: `1px dashed ${colors.border}`, fontSize: 13, fontFamily: fontBody, fontStyle: 'italic', color: colors.text }}>
                        <strong style={{ fontFamily: fontUI, fontStyle: 'normal', fontSize: 11, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase' }}>Tema: </strong>
                        {item.temaConsulta.substring(0, 200)}{item.temaConsulta.length > 200 ? '...' : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <div key={`n_${item.id}`} style={{ background: colors.cardBg, padding: 24, borderRadius: 8, border: `1px solid ${colors.border}`, borderLeft: `4px solid ${colors.accent}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, background: colors.accent, color: colors.primary, padding: '3px 8px', borderRadius: 3 }}>Nota</span>
                        </div>
                        <div style={{ fontFamily: fontDisplay, fontSize: 22, color: colors.primary, fontWeight: 600 }}>
                          {item.consultanteNombre || 'Sin consultante'}
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: colors.textMuted }}>
                          {(item.sesionNum || item.consultaDe) && <span><Hash size={11} style={{ display: 'inline', marginRight: 4 }} />Consulta {item.sesionNum || '?'} de {item.consultaDe || '?'}</span>}
                          <span><Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />{new Date(item.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { editarNota(item); setActiveTab('notas'); }} style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: '8px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                          Editar
                        </button>
                        <button onClick={() => eliminarNota(item.id)} style={{ background: 'transparent', border: `1px solid ${colors.danger}`, color: colors.danger, padding: '8px 12px', borderRadius: 4, cursor: 'pointer' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {item.contenido && (
                      <div style={{ paddingTop: 12, borderTop: `1px dashed ${colors.border}`, fontSize: 13, fontFamily: fontBody, fontStyle: 'italic', color: colors.text, lineHeight: 1.5 }}>
                        "{item.contenido.substring(0, 240)}{item.contenido.length > 240 ? '...' : ''}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
              );
            })()}
          </div>
        )}

        {/* ============ MI BIBLIOTECA ============ */}
        {activeTab === 'biblioteca' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: fontDisplay, fontSize: 32, margin: 0, color: colors.vino, fontWeight: 500 }}>
                Mi Biblioteca
              </h2>
              <p style={{ color: colors.textMuted, marginTop: 4, fontSize: 14 }}>
                {biblioteca.length} {biblioteca.length === 1 ? 'respuesta guardada' : 'respuestas guardadas'} · Respuestas que pasaste desde el chat de AYUDA
              </p>
            </div>

            {biblioteca.length > 0 && (
              <div style={{ background: colors.cardBg, padding: 20, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 20 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 14, top: 14, color: colors.textMuted }} />
                  <input
                    type="text"
                    value={bibliotecaBusqueda}
                    onChange={(e) => setBibliotecaBusqueda(e.target.value)}
                    placeholder="Buscar en tus respuestas guardadas..."
                    style={{ width: '100%', padding: '12px 14px 12px 40px', border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            {biblioteca.length === 0 ? (
              <div style={{ background: colors.cardBg, padding: 60, textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: 8, color: colors.textMuted }}>
                <Library size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ margin: '0 0 6px' }}>Tu biblioteca está vacía</p>
                <p style={{ margin: 0, fontSize: 13 }}>Abre el chat de <strong style={{ color: colors.vino }}>AYUDA</strong> y usa el botón <em>"Pasar a Mi Biblioteca"</em> debajo de una respuesta para guardarla aquí.</p>
              </div>
            ) : bibliotecaFiltrada.length === 0 ? (
              <div style={{ background: colors.cardBg, padding: 40, textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: 8, color: colors.textMuted }}>
                <p style={{ margin: 0 }}>Ninguna respuesta coincide con "{bibliotecaBusqueda}".</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {bibliotecaFiltrada.map(b => (
                  <div key={b.id} style={{ background: colors.cardBg, borderRadius: 8, border: `1px solid ${colors.border}`, borderLeft: `4px solid ${colors.vino}`, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.vino, fontWeight: 700, fontFamily: fontUI, marginBottom: 4 }}>
                          {new Date(b.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        {bibEditandoId === b.id ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              value={bibTituloInput}
                              onChange={(e) => setBibTituloInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') guardarTituloBiblioteca(); if (e.key === 'Escape') setBibEditandoId(null); }}
                              autoFocus
                              style={{ flex: 1, padding: '8px 10px', border: `1px solid ${colors.vino}`, borderRadius: 4, fontSize: 16, fontFamily: fontDisplay, fontWeight: 600, color: colors.primary, background: colors.bg, outline: 'none', boxSizing: 'border-box' }}
                            />
                            <button onClick={guardarTituloBiblioteca} title="Guardar título" style={{ background: colors.vino, color: '#fff', border: 'none', borderRadius: 4, padding: '8px 10px', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><Check size={16} /></button>
                            <button onClick={() => setBibEditandoId(null)} title="Cancelar" style={{ background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 4, padding: '8px 10px', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><X size={16} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontFamily: fontDisplay, fontSize: 16, color: colors.primary, fontWeight: 600, lineHeight: 1.4 }}>
                              {b.titulo || b.pregunta || 'Sin título'}
                            </div>
                            <button onClick={() => iniciarEdicionTitulo(b)} title="Editar título" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: 2, display: 'flex', flexShrink: 0 }}><Pencil size={14} /></button>
                          </div>
                        )}
                        {b.pregunta && b.pregunta !== (b.titulo || '') && (
                          <div style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 4, fontFamily: fontBody }}>
                            Pregunta: {b.pregunta}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => eliminarDeBiblioteca(b.id)}
                        title="Quitar de Mi Biblioteca"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.danger, padding: 4, display: 'flex', flexShrink: 0 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.7, fontFamily: fontBody, color: colors.text, whiteSpace: 'pre-wrap', paddingTop: 12, borderTop: `1px dashed ${colors.border}` }}>
                      {b.respuesta}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* MODAL NUEVA CITA */}
      {showCitaModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(31, 38, 34, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: colors.cardBg, borderRadius: 8, padding: 32, maxWidth: 500, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontFamily: fontDisplay, fontSize: 24, margin: 0, color: colors.primary }}>{citaEditando ? 'Editar Cita' : 'Nueva Cita'}</h3>
              <button onClick={cerrarCitaModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>Consultante</label>
              <select
                value={nuevaCita.consultanteId}
                onChange={(e) => setNuevaCita({ ...nuevaCita, consultanteId: e.target.value })}
                style={{ width: '100%', padding: 12, border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, background: colors.bg, boxSizing: 'border-box' }}
              >
                <option value="">— Seleccionar —</option>
                {consultantes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>Fecha</label>
              <input type="date" value={nuevaCita.fecha} onChange={(e) => setNuevaCita({ ...nuevaCita, fecha: e.target.value })} style={{ width: '100%', padding: 12, border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, background: colors.bg, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>De</label>
                <select
                  value={nuevaCita.hora}
                  onChange={(e) => setNuevaCita({ ...nuevaCita, hora: e.target.value })}
                  style={{ width: '100%', padding: 12, border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, background: colors.bg, boxSizing: 'border-box' }}
                >
                  <option value="">— Seleccionar —</option>
                  {horarios.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>Hasta</label>
                <select
                  value={nuevaCita.horaFin}
                  onChange={(e) => setNuevaCita({ ...nuevaCita, horaFin: e.target.value })}
                  style={{ width: '100%', padding: 12, border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, background: colors.bg, boxSizing: 'border-box' }}
                >
                  <option value="">— Seleccionar —</option>
                  {horarios.filter(h => !nuevaCita.hora || minutosDeHora(h) > minutosDeHora(nuevaCita.hora)).map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6, fontWeight: 600 }}>Notas</label>
              <textarea value={nuevaCita.notas} onChange={(e) => setNuevaCita({ ...nuevaCita, notas: e.target.value })} rows={2} style={{ width: '100%', padding: 12, border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 14, background: colors.bg, boxSizing: 'border-box', fontFamily: fontBody, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={guardarCita} style={{ flex: 1, background: colors.primary, color: '#fff', border: 'none', padding: 14, borderRadius: 4, cursor: 'pointer', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13 }}>{citaEditando ? 'Guardar Cambios' : 'Guardar Cita'}</button>
              <button onClick={cerrarCitaModal} style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: 14, borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            </div>
            {citaEditando && (
              <button
                onClick={eliminarCitaDesdeModal}
                style={{ width: '100%', marginTop: 12, background: 'transparent', border: `1px solid ${colors.danger}`, color: colors.danger, padding: 14, borderRadius: 4, cursor: 'pointer', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Trash2 size={15} /> Eliminar Cita
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL API KEY */}
      {showApiKeyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 30, 51, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: colors.cardBg, borderRadius: 8, padding: 32, maxWidth: 540, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: fontDisplay, fontSize: 22, margin: 0, color: colors.primary, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Key size={20} /> API Key de Anthropic
              </h3>
              <button onClick={() => setShowApiKeyModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.5, marginTop: 0 }}>
              Pega aquí tu API Key de Anthropic. Se guardará localmente en este navegador (localStorage) y nunca se envía a otro lugar más que a la API de Anthropic.
              <br />
              Obtén una en <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: colors.primary }}>console.anthropic.com</a>.
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-ant-api03-..."
              style={{ width: '100%', padding: 12, border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 13, background: colors.bg, boxSizing: 'border-box', fontFamily: 'monospace' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => {
                  const k = apiKeyInput.trim();
                  setApiKey(k);
                  if (k) localStorage.setItem('anthropic_api_key', k);
                  else localStorage.removeItem('anthropic_api_key');
                  setShowApiKeyModal(false);
                }}
                style={{ flex: 1, background: colors.primary, color: '#fff', border: 'none', padding: 14, borderRadius: 4, cursor: 'pointer', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13 }}
              >
                Guardar
              </button>
              {apiKey && (
                <button
                  onClick={() => {
                    setApiKey('');
                    setApiKeyInput('');
                    localStorage.removeItem('anthropic_api_key');
                    setShowApiKeyModal(false);
                  }}
                  style={{ background: 'transparent', border: `1px solid ${colors.danger}`, color: colors.danger, padding: 14, borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                >
                  Borrar
                </button>
              )}
              <button onClick={() => setShowApiKeyModal(false)} style={{ background: 'transparent', border: `1px solid ${colors.border}`, padding: 14, borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VER REPORTE */}
      {reporteVisualizando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(31, 38, 34, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, overflowY: 'auto' }}>
          <div style={{ background: colors.cardBg, borderRadius: 8, maxWidth: 800, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: 24, borderBottom: `2px solid ${colors.accent}`, background: colors.primary, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accentSoft, textTransform: 'uppercase' }}>Reporte de Sesión · Logoterapia</div>
                <h3 style={{ fontFamily: fontDisplay, fontSize: 24, margin: '4px 0 0', fontWeight: 500 }}>{reporteVisualizando.consultanteNombre}</h3>
              </div>
              <button onClick={() => setReporteVisualizando(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ padding: 32 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24, padding: 20, background: colors.soft, borderRadius: 4 }}>
                <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Orientador</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{reporteVisualizando.orientador || '—'}</div></div>
                <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Edad</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{reporteVisualizando.edad || '—'} años</div></div>
                <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Consulta</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{reporteVisualizando.sesionNum} de {reporteVisualizando.consultaDe}</div></div>
                <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Total de Sesiones</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{reporteVisualizando.totalSesiones || '—'}</div></div>
                <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Fecha</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{new Date(reporteVisualizando.fecha).toLocaleDateString('es-MX')}</div></div>
                <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Tiempo de Sesión</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{reporteVisualizando.tiempoSesion || '—'}</div></div>
              </div>

              {[
                { titulo: 'Motivo de Consulta', valor: reporteVisualizando.motivoConsulta },
                { titulo: 'Tema de Consulta', valor: reporteVisualizando.temaConsulta },
                { titulo: 'Intervención', valor: reporteVisualizando.intervencion },
                { titulo: 'Auto-Observación', valor: reporteVisualizando.autoObservacion }
              ].map(seccion => (
                <div key={seccion.titulo} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{seccion.titulo}</div>
                  <div style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 1.7, color: colors.text, padding: 16, background: colors.bg, borderRadius: 4, borderLeft: `3px solid ${colors.accent}`, whiteSpace: 'pre-wrap' }}>
                    {seccion.valor || <em style={{ color: colors.textMuted }}>— Sin información —</em>}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 12, marginTop: 32, paddingTop: 24, borderTop: `1px solid ${colors.border}` }}>
                <button onClick={() => exportarReporte(reporteVisualizando)} style={{ flex: 1, background: colors.accent, color: colors.primary, border: 'none', padding: 14, borderRadius: 4, cursor: 'pointer', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Download size={16} /> Exportar Reporte
                </button>
                <button onClick={() => cargarReporte(reporteVisualizando)} style={{ flex: 1, background: colors.primary, color: '#fff', border: 'none', padding: 14, borderRadius: 4, cursor: 'pointer', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13 }}>
                  Editar Reporte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FICHA CONSULTANTE */}
      {consultanteVisualizando && (() => {
        const c = consultanteVisualizando;
        const sesionesConsultante = sesiones.filter(s => s.consultanteId === c.id);
        const notasConsultante = notas.filter(n => n.consultanteId === c.id);
        const ultimaSesion = sesionesConsultante.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
        return (
          <div onClick={() => setConsultanteVisualizando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(31, 38, 34, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, overflowY: 'auto' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: colors.cardBg, borderRadius: 8, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ padding: 24, borderBottom: `2px solid ${colors.accent}`, background: colors.primary, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accentSoft, textTransform: 'uppercase' }}>Ficha del Consultante</div>
                  <h3 style={{ fontFamily: fontDisplay, fontSize: 24, margin: '4px 0 0', fontWeight: 500 }}>{c.nombre}</h3>
                </div>
                <button onClick={() => setConsultanteVisualizando(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff' }}>
                  <X size={24} />
                </button>
              </div>
              <div style={{ padding: 32 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24, padding: 20, background: colors.soft, borderRadius: 4 }}>
                  <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Edad</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{c.edad ? `${c.edad} años` : '—'}</div></div>
                  <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Teléfono</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{c.telefono || '—'}</div></div>
                  <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Quién lo refiere</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{c.quienRefiere || '—'}</div></div>
                  <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Fecha de alta</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{c.fechaAlta ? new Date(c.fechaAlta).toLocaleDateString('es-MX') : '—'}</div></div>
                  <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Sesiones registradas</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{sesionesConsultante.length}</div></div>
                  <div><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Notas registradas</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{notasConsultante.length}</div></div>
                  {ultimaSesion && (
                    <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Última sesión</div><div style={{ fontFamily: fontBody, fontSize: 14, fontWeight: 600 }}>{new Date(ultimaSesion.fecha).toLocaleDateString('es-MX')}</div></div>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Motivo de Consulta</div>
                  <div style={{ fontFamily: fontBody, fontSize: 14, lineHeight: 1.7, color: colors.text, padding: 16, background: colors.bg, borderRadius: 4, borderLeft: `3px solid ${colors.accent}`, whiteSpace: 'pre-wrap' }}>
                    {c.motivoConsulta || <em style={{ color: colors.textMuted }}>— Sin información —</em>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 32, paddingTop: 24, borderTop: `1px solid ${colors.border}` }}>
                  <button onClick={() => setConsultanteVisualizando(null)} style={{ flex: 1, background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`, padding: 14, borderRadius: 4, cursor: 'pointer', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13 }}>
                    Cerrar
                  </button>
                  <button onClick={() => { editarConsultante(c); setConsultanteVisualizando(null); }} style={{ flex: 1, background: colors.primary, color: '#fff', border: 'none', padding: 14, borderRadius: 4, cursor: 'pointer', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 13 }}>
                    Editar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============ AYUDA — BOTÓN FLOTANTE + CHAT ABIERTO ============ */}
      {!showAyuda && (
        <button
          onClick={abrirAyuda}
          title="Abrir chat de ayuda"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 900,
            background: colors.vino, color: '#fff', border: 'none', borderRadius: 999,
            padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', fontSize: 15, fontWeight: 700, letterSpacing: 1,
            boxShadow: '0 8px 24px rgba(110,31,43,0.45)', fontFamily: fontUI
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = colors.vinoHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = colors.vino; }}
        >
          <HelpCircle size={20} /> AYUDA
        </button>
      )}

      {showAyuda && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 901,
          width: 'min(420px, calc(100vw - 32px))', height: 'min(620px, calc(100vh - 48px))',
          background: colors.cardBg, borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 24px 70px rgba(0,0,0,0.38)', border: `1px solid ${colors.border}`,
          display: 'flex', flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{ background: colors.vino, color: '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {ayudaVista === 'chat' && ayudaConversaciones.length > 0 && (
              <button onClick={() => setAyudaVista('lista')} title="Ver conversaciones" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={18} />
              </button>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <HelpCircle size={18} />
              <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>
                {ayudaVista === 'lista' ? 'AYUDA · Conversaciones' : 'AYUDA'}
              </div>
            </div>
            {ayudaVista === 'chat' && (
              <button onClick={nuevaConversacionAyuda} title="Nueva conversación" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={18} />
              </button>
            )}
            <button onClick={() => setShowAyuda(false)} title="Cerrar" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
          </div>

          {/* Cuerpo */}
          {ayudaVista === 'lista' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: colors.bg }}>
              <button
                onClick={nuevaConversacionAyuda}
                style={{ width: '100%', background: colors.vino, color: '#fff', border: 'none', padding: 12, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, fontFamily: fontUI }}
                onMouseEnter={(e) => { e.currentTarget.style.background = colors.vinoHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = colors.vino; }}
              >
                <Plus size={16} /> Nueva conversación
              </button>
              {ayudaConversaciones.length === 0 ? (
                <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: 13, padding: 24, fontFamily: fontBody }}>
                  Aún no hay conversaciones. Empieza una nueva.
                </div>
              ) : (
                [...ayudaConversaciones]
                  .sort((a, b) => new Date(b.actualizada) - new Date(a.actualizada))
                  .map(c => (
                    <div
                      key={c.id}
                      onClick={() => abrirConversacionAyuda(c.id)}
                      style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: fontBody }}>
                          {c.titulo || 'Conversación'}
                        </div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, fontFamily: fontBody }}>
                          {new Date(c.actualizada).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {c.mensajes.length} {c.mensajes.length === 1 ? 'mensaje' : 'mensajes'}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); eliminarConversacionAyuda(c.id); }} title="Eliminar conversación" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.danger, padding: 4, display: 'flex' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
              )}
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: colors.bg, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(() => {
                  const conv = ayudaConversaciones.find(c => c.id === ayudaActivaId);
                  const mensajes = conv ? conv.mensajes : [];
                  if (mensajes.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', color: colors.textMuted, margin: 'auto', padding: 20, fontFamily: fontBody }}>
                        <HelpCircle size={36} style={{ opacity: 0.4, marginBottom: 12, color: colors.vino }} />
                        <div style={{ fontFamily: fontDisplay, fontSize: 18, color: colors.primary, marginBottom: 6 }}>¿En qué te ayudo?</div>
                        <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
                          Pregunta lo que quieras al instante. Esta conversación se guardará automáticamente.
                        </div>
                      </div>
                    );
                  }
                  return mensajes.map((m, i) => {
                    const guardado = m.role === 'assistant' && estaEnBiblioteca(ayudaActivaId, i);
                    const esError = m.role === 'assistant' && m.content.startsWith('⚠');
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
                          <div style={{
                            padding: '10px 14px', borderRadius: 10,
                            background: m.role === 'user' ? colors.vino : colors.cardBg,
                            color: m.role === 'user' ? '#fff' : colors.text,
                            border: m.role === 'user' ? 'none' : `1px solid ${colors.border}`,
                            fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: fontBody
                          }}>
                            {m.content}
                          </div>
                          {m.role === 'assistant' && !esError && (
                            guardado ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: colors.textMuted, fontFamily: fontUI }}>
                                <Check size={13} color={colors.vino} /> Guardado en Mi Biblioteca
                              </span>
                            ) : (
                              <button
                                onClick={() => guardarEnBiblioteca(ayudaActivaId, i)}
                                title="Guardar esta respuesta en Mi Biblioteca"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${colors.vino}`, color: colors.vino, borderRadius: 999, padding: '5px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer', fontFamily: fontUI, textTransform: 'uppercase' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = colors.vino; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.vino; }}
                              >
                                <BookmarkPlus size={13} /> Pasar a Mi Biblioteca
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
                {ayudaCargando && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 13, color: colors.textMuted, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span style={{ width: 6, height: 6, background: colors.vino, borderRadius: '50%', animation: 'ayudaPulse 1.4s ease-in-out infinite' }}></span>
                        <span style={{ width: 6, height: 6, background: colors.vino, borderRadius: '50%', animation: 'ayudaPulse 1.4s ease-in-out 0.2s infinite' }}></span>
                        <span style={{ width: 6, height: 6, background: colors.vino, borderRadius: '50%', animation: 'ayudaPulse 1.4s ease-in-out 0.4s infinite' }}></span>
                      </div>
                      Pensando…
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: 12, borderTop: `1px solid ${colors.border}`, background: colors.cardBg, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={ayudaInput}
                  onChange={(e) => setAyudaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensajeAyuda(); } }}
                  placeholder="Escribe tu pregunta…"
                  rows={1}
                  style={{ flex: 1, padding: '10px 12px', border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 14, fontFamily: fontBody, background: colors.bg, outline: 'none', resize: 'none', boxSizing: 'border-box', maxHeight: 120, lineHeight: 1.4 }}
                />
                <button
                  onClick={enviarMensajeAyuda}
                  disabled={ayudaCargando || !ayudaInput.trim()}
                  title="Enviar"
                  style={{ background: (ayudaCargando || !ayudaInput.trim()) ? colors.border : colors.vino, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 14px', cursor: (ayudaCargando || !ayudaInput.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}

          <style>{`
            @keyframes ayudaPulse {
              0%, 100% { opacity: 0.3; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.2); }
            }
          `}</style>
        </div>
      )}

      {/* FOOTER */}
      <footer style={{ background: colors.primary, color: '#C5D2E0', padding: '24px 48px', marginTop: 60, textAlign: 'center', fontSize: 12 }}>
        <div style={{ fontFamily: fontDisplay, fontSize: 14, color: colors.accent, fontStyle: 'italic', marginBottom: 4 }}>
          Plataforma de Inteligencia Clínica de Claudia Talamantes Dosal
        </div>
        <div>Acompañando a las personas a encontrar su sentido de vida</div>
      </footer>
    </div>
  );
};

export default App;
