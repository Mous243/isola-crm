export default function Guia() {
  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', padding: '16px', maxWidth: '480px', margin: '0 auto', fontFamily: '-apple-system, sans-serif', color: '#e2e8f0' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0 }
        .bloque { background: #1e293b; border-radius: 16px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #334155 }
        .bloque.auto { border-left-color: #22c55e }
        .bloque.manual { border-left-color: #a78bfa }
        .bloque.info { border-left-color: #3b82f6 }
        .hora { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #64748b; margin-bottom: 6px }
        .titulo { font-size: 16px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap }
        .badge { font-size: 10px; padding: 2px 8px; border-radius: 99px; font-weight: 600 }
        .badge.auto { background: #14532d; color: #86efac }
        .badge.manual { background: #2e1065; color: #c4b5fd }
        ul { padding-left: 0; list-style: none }
        li { font-size: 14px; color: #94a3b8; padding: 4px 0; display: flex; gap: 8px }
        li::before { content: "→"; color: #475569; flex-shrink: 0 }
        .tag { display: inline-block; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 3px 10px; font-size: 12px; margin: 3px 2px; color: #94a3b8 }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px }
        td { padding: 8px 6px; border-bottom: 1px solid #0f172a }
        tr:last-child td { border-bottom: none }
        .auto-td { color: #86efac; text-align: right }
        .manual-td { color: #c4b5fd; text-align: right }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
        <img src="/icon-192.png" alt="ISOLA" style={{ width: 80, borderRadius: 16 }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#a78bfa', marginTop: 10 }}>Guía Diaria ISOLA</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Lo que haces cada día en campo</p>
      </div>

      <div className="bloque auto">
        <div className="hora">☀️ 7:00 AM</div>
        <div className="titulo">Alerta de buenos días <span className="badge auto">Automático</span></div>
        <ul>
          <li>Telegram te manda: cobros urgentes y clientes sin visitar</li>
          <li><strong style={{color:'#e2e8f0'}}>Solo leerlo</strong>, no tienes que hacer nada</li>
        </ul>
      </div>

      <div className="bloque manual">
        <div className="hora">🚗 Antes de salir</div>
        <div className="titulo">Preparar el día <span className="badge manual">Tú</span></div>
        <ul>
          <li>Abre el <strong style={{color:'#e2e8f0'}}>CRM web</strong> → revisa el banner de arriba</li>
          <li>Si hay oferta → abre <strong style={{color:'#e2e8f0'}}>generar_status.bat</strong> en la PC</li>
        </ul>
      </div>

      <div className="bloque manual">
        <div className="hora">🏪 8:00 AM – 4:00 PM</div>
        <div className="titulo">En campo <span className="badge manual">Tú</span></div>
        <ul>
          <li>Toma pedidos con la <strong style={{color:'#e2e8f0'}}>app oficial ISOLA</strong> (GPS)</li>
          <li>Después de cada visita → registra en el <strong style={{color:'#e2e8f0'}}>CRM web</strong>:
            <span style={{display:'block', marginTop:4}}>
              <span className="tag">cliente</span><span className="tag">resultado</span><span className="tag">monto</span><span className="tag">notas</span>
            </span>
          </li>
        </ul>
      </div>

      <div className="bloque auto">
        <div className="hora">💰 10:00 AM</div>
        <div className="titulo">Recordatorios de cobro <span className="badge auto">Automático</span></div>
        <ul>
          <li>Bot WhatsApp avisa a clientes con cobros en 3 días</li>
          <li>No tienes que hacer nada</li>
        </ul>
      </div>

      <div className="bloque info">
        <div className="hora">🍽️ Mediodía</div>
        <div className="titulo">Revisar progreso</div>
        <ul>
          <li>Escribe <strong style={{color:'#e2e8f0'}}>/estado</strong> en Telegram para ver tu avance</li>
        </ul>
      </div>

      <div className="bloque auto">
        <div className="hora">🔄 3:00 PM</div>
        <div className="titulo">Seguimientos <span className="badge auto">Automático</span></div>
        <ul>
          <li>Bot WhatsApp escribe a clientes que no compraron hoy</li>
          <li>No tienes que hacer nada</li>
        </ul>
      </div>

      <div className="bloque auto">
        <div className="hora">🌆 8:00 PM</div>
        <div className="titulo">Avisos de visita <span className="badge auto">Automático</span></div>
        <ul>
          <li>Bot WhatsApp avisa a los clientes de mañana que vas a pasar</li>
          <li>No tienes que hacer nada</li>
        </ul>
      </div>

      <div className="bloque auto">
        <div className="hora">🌙 9:00 PM</div>
        <div className="titulo">Resumen del día <span className="badge auto">Automático</span></div>
        <ul>
          <li>Telegram manda: visitas, pedidos, monto, tasa de cierre</li>
          <li>CRM web → banner nocturno con los mismos datos</li>
        </ul>
      </div>

      <div className="bloque">
        <div className="titulo">📋 Resumen rápido</div>
        <table>
          <tbody>
            <tr><td>Registrar visitas</td><td className="manual-td">Tú (CRM web)</td></tr>
            <tr><td>Tomar pedidos</td><td className="manual-td">Tú (App ISOLA)</td></tr>
            <tr><td>Publicar Status oferta</td><td className="manual-td">Tú (PC)</td></tr>
            <tr><td>Alerta 7am</td><td className="auto-td">Automático</td></tr>
            <tr><td>Cobros 10am</td><td className="auto-td">Automático</td></tr>
            <tr><td>Seguimientos 3pm</td><td className="auto-td">Automático</td></tr>
            <tr><td>Avisos visita 8pm</td><td className="auto-td">Automático</td></tr>
            <tr><td>Resumen 9pm</td><td className="auto-td">Automático</td></tr>
          </tbody>
        </table>
      </div>

      <div className="bloque info">
        <div className="titulo">📱 Comandos Telegram</div>
        <ul>
          <li><strong style={{color:'#e2e8f0'}}>/estado</strong> — stats del día en tiempo real</li>
          <li><strong style={{color:'#e2e8f0'}}>/cobros</strong> — cobros urgentes</li>
          <li><strong style={{color:'#e2e8f0'}}>/sinvisitar</strong> — clientes sin visitar esta semana</li>
        </ul>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: '#334155', padding: '20px 0 8px' }}>
        ISOLA CRM · Sistema personal del vendedor
      </div>
    </div>
  )
}
