/* ── ESTADO DEL FORMULARIO ── */
let hallazgoCount  = 0;
const MAX_HALLAZGOS = 20;

// Aquí almacenaremos las imágenes en formato Base64 comprimido
const fotoStores = {
  'señal-preview': [],
  'fachada-preview': []
};

/* ── RECOLECTAR ARCHIVOS Y CONVERTIR A BASE64 COMPRIMIDO ── */
function handleFileSelect(input, previewId, maxFiles) {
  const files = Array.from(input.files);
  if (!fotoStores[previewId]) fotoStores[previewId] = [];
  
  const existing = fotoStores[previewId].filter(Boolean).length;
  const available = maxFiles - existing;
  
  if (available <= 0) {
    showToast(`Máximo ${maxFiles} foto(s) permitida(s) aquí.`, 'error');
    return;
  }
  
  const toAdd = files.slice(0, available);
  
  toAdd.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      // Crear una imagen para redimensionar y comprimir en campo
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Redimensionar para optimizar peso del PDF y envío de correo (máx 800px)
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        } else if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Calidad 0.7 para mantener balance nitidez/peso
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        
        const idx = fotoStores[previewId].length;
        fotoStores[previewId].push(compressedBase64);
        renderThumbnail(previewId, compressedBase64, idx);
      };
    };
    reader.readAsDataURL(file);
  });
}

function renderThumbnail(previewId, dataURL, idx) {
  const grid = document.getElementById(previewId);
  if (!grid) return;
  const div = document.createElement('div');
  div.className = 'preview-thumb';
  div.id = `thumb-${previewId}-${idx}`;
  div.innerHTML = `
    <img src="${dataURL}" alt="foto">
    <button class="remove-btn" type="button" onclick="removePhoto('${previewId}',${idx})">✕</button>`;
  grid.appendChild(div);
}

function removePhoto(previewId, idx) {
  if (!fotoStores[previewId]) return;
  fotoStores[previewId][idx] = null;
  const thumb = document.getElementById(`thumb-${previewId}-${idx}`);
  if (thumb) thumb.remove();
}

/* ── MANEJO DINÁMICO DE HALLAZGOS ── */
function agregarHallazgo() {
  if (hallazgoCount >= MAX_HALLAZGOS) {
    showToast(`Límite de ${MAX_HALLAZGOS} hallazgos alcanzado.`, 'error');
    return;
  }
  
  hallazgoCount++;
  const container = document.getElementById('hallazgos-container');
  const uniqueId = 'h_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const previewId = `prev-${uniqueId}`;
  const fileId    = `file-${uniqueId}`;
  const areaId    = `area-${uniqueId}`;

  fotoStores[previewId] = []; // Inicializar almacén de fotos para este ítem

  const row = document.createElement('div');
  row.className = 'hallazgo-row';
  row.id = `row-${uniqueId}`;
  row.innerHTML = `
    <div class="hallazgo-header">
      <div class="hallazgo-num">${hallazgoCount}</div>
      <div class="hallazgo-title">Hallazgo / Ítem #${hallazgoCount}</div>
      <button class="remove-hallazgo" type="button" onclick="eliminarHallazgo('${uniqueId}')">🗑</button>
    </div>
    <div class="field">
      <label>Descripción del elemento afectado <span class="req">*</span></label>
      <textarea id="desc-${uniqueId}" placeholder="Ej.: Filtración activa en losa alta, grifería dañada..." rows="2" required></textarea>
    </div>
    <div class="field">
      <label>Propuesta / Recomendación Técnica <span class="req">*</span></label>
      <textarea id="rec-${uniqueId}" placeholder="Ej.: Demolición de manto asfáltico, sustitución por tubería PVC..." rows="2" required></textarea>
    </div>
    <div class="hallazgo-photo-mini field">
      <label>📸 Fotografía del hallazgo <span class="hint">— Máx. 1 foto por hallazgo</span></label>
      <div class="photo-upload-area" id="${areaId}">
        <input type="file" id="${fileId}" accept="image/*" onchange="handleFileSelect(this,'${previewId}',1)">
        <div class="upload-icon" style="font-size:20px;">📷</div>
        <div class="upload-text"><strong>Capturar o cargar foto</strong></div>
      </div>
      <div class="hallazgo-preview" id="${previewId}"></div>
    </div>`;

  container.appendChild(row);
  actualizarContador();
}

function eliminarHallazgo(id) {
  document.getElementById(`row-${id}`)?.remove();
  delete fotoStores[`prev-${id}`];
  hallazgoCount--;
  actualizarContador();
  
  document.querySelectorAll('.hallazgo-row').forEach((r, i) => {
    r.querySelector('.hallazgo-num').textContent = i + 1;
    r.querySelector('.hallazgo-title').textContent = `Hallazgo / Ítem #${i + 1}`;
  });
}

function actualizarContador() {
  document.getElementById('hallazgo-count').textContent = `${hallazgoCount} / ${MAX_HALLAZGOS} hallazgos registrados`;
}

/* ── GENERACIÓN DE REPORTE PDF CON IMÁGENES INTEGRADAS ── */
async function generarPDFObjeto() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  
  const data = recolectarDatos();
  const navy = [11, 31, 58], sky = [26, 110, 189], amber = [232, 160, 32], grayDark = [51, 65, 85];

  // 1. Encabezado Corporativo Banner
  doc.setFillColor(...amber); doc.rect(0, 0, 210, 3, 'F');
  doc.setFillColor(...navy); doc.rect(0, 3, 210, 25, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("INFORME DE LEVANTAMIENTO FOTOGRÁFICO", 14, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(214, 232, 247);
  doc.text("Corporación Daico 2024, C.A. — División de Infraestructura", 14, 19);

  // Datos Generales de Ubicación
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...navy);
  doc.text("1. Información de Control y Ubicación", 14, 38);

  doc.autoTable({
    startY: 41, theme: 'grid',
    headStyles: { fillColor: [...sky], fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    head: [['Parámetro Inspeccionado', 'Registro en Campo']],
    body: [
      ['Fecha / Hora de Registro', `${data.meta.fecha} — ${data.meta.hora}`],
      ['Inspector Responsable', data.meta.inspector || 'No registrado'],
      ['Terminal de Operación', data.meta.terminal || 'No especificado'],
      ['Nivel / Planta', data.meta.nivel || 'No especificado'],
      ['Puerta de Embarque de Referencia (Gate)', data.meta.gate || 'No registrado'],
      ['Prioridad Asignada', data.meta.prioridad ? data.meta.prioridad.toUpperCase() : 'MEDIA']
    ],
    margin: { left: 14, right: 14 }
  });

  let currentY = doc.lastAutoTable.finalY + 10;

  // Fotos Iniciales (Señalética y Fachada)
  doc.setFont("helvetica", "bold"); doc.text("2. Registro de Fachada y Punto de Acceso", 14, currentY);
  currentY += 4;

  const fotoSeñal = (fotoStores['señal-preview'] || []).filter(Boolean)[0];
  const fotoFachada = (fotoStores['fachada-preview'] || []).filter(Boolean)[0];

  if (fotoSeñal) {
    try { doc.addImage(fotoSeñal, 'JPEG', 14, currentY, 42, 32); } catch(e){}
  } else {
    doc.setFontSize(8); doc.text("[Sin Foto Señalética]", 20, currentY + 15);
  }

  if (fotoFachada) {
    try { doc.addImage(fotoFachada, 'JPEG', 65, currentY, 42, 32); } catch(e){}
  } else {
    doc.setFontSize(8); doc.text("[Sin Foto Fachada]", 70, currentY + 15);
  }
  
  currentY += 38;

  // Sección de Hallazgos con Imágenes en Fila
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
  doc.text("3. Matriz de Hallazgos Críticos Detectados", 14, currentY);
  currentY += 3;

  // Armar tabla de hallazgos
  const tableRows = [];
  data.hallazgos.forEach(h => {
    tableRows.push([
      h.numero,
      h.descripcion || 'Sin descripción',
      h.recomendacion || 'Sin propuesta',
      '' // Columna vacía reservada para pintar la foto mediante hooks
    ]);
  });

  doc.autoTable({
    startY: currentY,
    theme: 'grid',
    headStyles: { fillColor: [...navy] },
    styles: { fontSize: 8.5, cellPadding: 3, valign: 'middle' },
    columnStyles: { 
      0: { cellWidth: 8, halign: 'center' }, 
      1: { cellWidth: 64 }, 
      2: { cellWidth: 70 }, 
      3: { cellWidth: 40, halign: 'center' } 
    },
    head: [['#', 'Diagnóstico Estructural / Daño', 'Acción Recomendada', 'Registro Visual']],
    body: tableRows,
    margin: { left: 14, right: 14 },
    didDrawCell: function(dataCell) {
      // Dibujar la imagen dentro de la celda correspondiente empleando las coordenadas del hook
      if (dataCell.column.index === 3 && dataCell.cell.section === 'body') {
        const rowIdx = dataCell.row.index;
        const targetRow = document.querySelectorAll('.hallazgo-row')[rowIdx];
        if (targetRow) {
          const id = targetRow.id.replace('row-','');
          const base64Foto = (fotoStores[`prev-${id}`] || []).filter(Boolean)[0];
          if (base64Foto) {
            try {
              // Ajustar la posición y dimensiones para centrar dentro de la celda de la tabla
              doc.addImage(base64Foto, 'JPEG', dataCell.cell.x + 2, dataCell.cell.y + 1, 36, 18);
            } catch (err) {}
          }
        }
      }
    }
  });

  currentY = doc.lastAutoTable.finalY + 12;
  if (currentY > 230) { doc.addPage(); currentY = 20; }

  doc.setFont("helvetica", "bold"); doc.text("4. Observaciones Finales de Campo", 14, currentY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...grayDark);
  const splitObs = doc.splitTextToSize(document.getElementById('observaciones').value || "No se especifican comentarios complementarios.", 182);
  doc.text(splitObs, 14, currentY + 5);

  // Pie de página de numeración
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(130);
    doc.line(14, 282, 196, 282);
    doc.text("Corporación Daico 2024, C.A. · Dirección Operativa de Ingeniería", 14, 286);
    doc.text(`Página ${i} de ${totalPages}`, 182, 286);
  }

  return doc;
}

/* ── TRANSMISIÓN Y DESPACHO DEL INFORME POR EMAIL ── */
async function submitForm() {
  const inspector = document.getElementById('inspector').value;
  const gate = document.getElementById('gate').value;
  
  if(!inspector || !gate) {
    showToast('⚠️ Complete el nombre del inspector y el Gate de ubicación.', 'error');
    return;
  }

  showToast('⏳ Compilando PDF e integrando registros visuales...', 'success');
  
  const doc = await generarPDFObjeto();
  
  // Convertir el PDF generado a un formato binario legible para transporte de correo
  const pdfBlob = doc.output('blob');
  const gateLimpio = gate.replace(/[^a-z0-9]/gi, '_');
  const filename = `Levantamiento_Baños_Gate_${gateLimpio}.pdf`;

  // Preparar los datos textuales para el cuerpo del mensaje
  const data = recolectarDatos();

  // ENVÍO DE CORREO AUTOMATIZADO
  // Para producción transparente, puedes vincular un endpoint gratuito de Formspree o EmailJS.
  // Ejemplo empleando la API estándar FormData/Fetch:
  const formData = new FormData();
  formData.append('email', 'chernandez@daicocorp.com');
  formData.append('subject', `⚠️ NUEVO LEVANTAMIENTO - GATE ${data.meta.gate} - INSPECTOR: ${data.meta.inspector}`);
  formData.append('message', `Se ha generado un nuevo informe técnico de levantamiento en el Aeropuerto de Maiquetía.\n\nTerminal: ${data.meta.terminal}\nNivel: ${data.meta.nivel}\nPrioridad de Intervención: ${data.meta.prioridad}\nHallazgos totales: ${hallazgoCount}\n\nAdjunto encontrará el documento PDF con las descripciones y el soporte fotográfico incrustado.`);
  formData.append('attachment', pdfBlob, filename);

  try {
    // Reemplaza esta URL ficticia por tu Endpoint verificado de Formspree (ej: https://formspree.io/f/xvoxzz) o tu conector SMTP web
    const response = await fetch('https://formspree.io/f/TU_ENDPOINT_AQUÍ', {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      showToast('✉️ ¡Informe enviado exitosamente a chernandez@daicocorp.com!', 'success');
    } else {
      // Descarga de contingencia local si falla la red en los hangares
      doc.save(filename);
      showToast('⚠️ Conexión inestable. Archivo descargado en el dispositivo.', 'error');
    }
  } catch (err) {
    doc.save(filename);
    showToast('💾 Modo Offline detectado. Reporte guardado localmente en PDF.', 'success');
  }
}

async function exportarPDF() {
  showToast('📥 Generando copia para impresión...', 'success');
  const doc = await generarPDFObjeto();
  const gate = document.getElementById('gate').value || 'SN';
  doc.save(`Copia_Local_Baños_Gate_${gate.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

function recolectarDatos() {
  const hallazgos = [];
  document.querySelectorAll('.hallazgo-row').forEach((row, i) => {
    const id = row.id.replace('row-','');
    hallazgos.push({
      numero: i + 1,
      descripcion: document.getElementById(`desc-${id}`)?.value || '',
      recomendacion: document.getElementById(`rec-${id}`)?.value || ''
    });
  });

  return {
    meta: {
      fecha: document.getElementById('fecha').value,
      hora: document.getElementById('hora').value,
      inspector: document.getElementById('inspector').value,
      terminal: document.querySelector('[name="terminal"]:checked')?.value || '',
      nivel: document.querySelector('[name="nivel"]:checked')?.value || '',
      gate: document.getElementById('gate').value,
      prioridad: document.querySelector('[name="prioridad"]:checked')?.value || ''
    },
    hallazgos: hallazgos
  };
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.textContent = msg; 
  toast.className = `show ${type}`;
  setTimeout(() => { toast.className = ''; }, 4000);
}