(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));
  let status;
  let files = [];
  let libraryRegistry = [];

  async function request(url, options = {}) {
    const response = await fetch(url, { headers: { "content-type": "application/json", ...(options.headers || {}) }, ...options });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || "Error"); error.data = data; throw error; }
    return data;
  }
  function toast(message) { const node=$("#toast"); node.textContent=message; node.hidden=false; setTimeout(()=>node.hidden=true,3200); }
  function result(selector, message, error=false) { const node=$(selector); node.textContent=message; node.classList.toggle("error",error); }

  async function loadStatus() {
    [status, libraryRegistry] = await Promise.all([request("/api/status"), request("/api/libraries")]);
    $("#server-state").textContent = status.rebuilding ? "Actualizando…" : `Atlas ${status.version} · ${status.pendingBuild ? "cambios pendientes" : "sincronizado"}`;
    $("#summary").innerHTML = [
      [status.documents,"Documentos"],[status.libraries.length,"Bibliotecas IA"],
      [Math.round(status.words/1e6*10)/10+" M","Palabras"],[status.external,"Tarjetas externas"]
    ].map(([value,label])=>`<article class="metric"><b>${value}</b><span>${label}</span></article>`).join("");
    const options=status.libraries.map(lib=>`<option value="${esc(lib.id)}">${esc(lib.short)} · ${lib.documents}</option>`).join("");
    $("#upload-library").innerHTML=options; $("#file-library").innerHTML=options;
    renderLibraries();
    await loadFiles();
  }

  function renderLibraries() {
    const counts = new Map(status.libraries.map(item => [item.id, item.documents]));
    $("#library-list").innerHTML=libraryRegistry.map(lib=>`<article class="library-admin" data-library-id="${esc(lib.id)}">
      <div class="library-summary">
        <span class="library-mark tone-${esc(lib.tone)}">${esc(lib.mark || lib.short[0])}</span>
        <span><b>${esc(lib.short)}</b><small>${esc(lib.folder)} · ${counts.get(lib.id) || 0} documentos</small></span>
        <button class="button compact" type="button" data-toggle-library>Configurar</button>
      </div>
      <form class="library-edit" hidden>
        <div class="form-row"><label>Nombre visible<input name="short" required value="${esc(lib.short)}"></label><label>Inicial<input name="mark" maxlength="2" value="${esc(lib.mark || "")}"></label></div>
        <label>Descripción<textarea name="description" rows="3">${esc(lib.description || "")}</textarea></label>
        <label>Enlace de NotebookLM<input name="notebookUrl" type="url" value="${esc(lib.notebookUrl || "")}"></label>
        <label>Color<select name="tone">${["amber","blue","clay","violet","emerald","rose","indigo","gold","cyan","olive","burgundy","slate"].map(tone=>`<option${tone===lib.tone?" selected":""}>${tone}</option>`).join("")}</select></label>
        <div class="library-actions"><button class="primary" type="submit">Guardar cambios</button><button class="danger library-delete" type="button" data-delete-library>Eliminar IA y carpeta</button></div>
        <div class="result" data-library-result></div>
      </form>
    </article>`).join("");
  }

  async function rebuildAndReload(message) {
    $("#server-state").textContent="Sincronizando bibliotecas…";
    const response=await request("/api/rebuild",{method:"POST",body:JSON.stringify({force:false})});
    if(!response.ok) throw new Error(response.message || "No se pudo reconstruir Atlas.");
    await loadStatus();
    toast(message);
  }

  async function loadFiles() {
    files = await request(`/api/files?library=${encodeURIComponent($("#file-library").value)}`);
    renderFiles();
  }
  function renderFiles() {
    const query=$("#file-filter").value.toLowerCase();
    const shown=files.filter(file=>`${file.title} ${file.category} ${file.file}`.toLowerCase().includes(query));
    $("#file-count").textContent=`${shown.length} de ${files.length}`;
    $("#file-list").innerHTML=shown.map(file=>`<article class="file-item"><span><b>${esc(file.title)}</b><small>${esc(file.file)} · ${esc(file.category)} · ${Number(file.words).toLocaleString("es-ES")} palabras</small></span><div class="button-row"><button class="compact" data-rename-file="${esc(file.file)}" data-file-title="${esc(file.title)}">Renombrar</button><button class="danger" data-delete-file="${esc(file.file)}">Papelera</button></div></article>`).join("");
  }

  async function loadEditors() {
    const [shorts, external, providers]=await Promise.all([request("/api/shorts"),request("/api/external"),request("/api/providers")]);
    $("#shorts-editor").value=JSON.stringify(shorts,null,2);
    $("#external-editor").value=JSON.stringify(external,null,2);
    $("#provider-youtube").value=JSON.stringify(providers.youtube,null,2);
    $("#provider-music").value=JSON.stringify(providers.music,null,2);
    $("#provider-instagram").value=JSON.stringify(providers.instagram,null,2);
  }

  async function renderAudit() {
    const audit=await request("/api/audit");
    const cards=[
      [audit.libraries,"Bibliotecas",false],
      [audit.sourceDocuments,"Fuentes Markdown",audit.sourceDocuments!==audit.catalogDocuments],
      [audit.catalogDocuments,"Catálogo",audit.catalogDocuments!==audit.generatedDocuments],
      [audit.generatedDocuments,"Lecturas generadas",audit.catalogDocuments!==audit.generatedDocuments],
      [audit.duplicates.exactScanDeferred?"Manual":audit.duplicates.exact.length,"Duplicados exactos",false],
      [audit.duplicates.titles.length,"Títulos repetidos",Boolean(audit.duplicates.titles.length)],
      [audit.pendingBuild?"Sí":"No","Cambios pendientes",audit.pendingBuild],
      [audit.distReady?"Lista":"Pendiente","Salida dist",!audit.distReady]
    ];
    $("#publication-audit").innerHTML=cards.map(([value,label,warning])=>`<article class="audit-card ${warning?"warning":""}"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join("");
    return audit;
  }

  $$(".tabs button").forEach(button=>button.addEventListener("click",()=>{
    $$(".tabs button").forEach(item=>item.classList.toggle("active",item===button));
    $$(".panel").forEach(panel=>panel.classList.toggle("active",panel.dataset.panel===button.dataset.tab));
  }));
  $("#file-library").addEventListener("change",loadFiles);
  $("#file-filter").addEventListener("input",renderFiles);
  $("#upload-file").addEventListener("change",event=>{
    const selected=[...event.target.files];
    $("#upload-queue").innerHTML=selected.map(file=>`<span>${esc(file.name)}<small>${Math.max(1,Math.round(file.size/1024))} KB</small></span>`).join("");
  });
  $("#upload-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const selected=[...$("#upload-file").files]; if(!selected.length)return;
    result("#upload-result",`Leyendo y comparando ${selected.length} obras…`);
    const submit=event.submitter; submit.disabled=true; submit.textContent="Procesando lote…";
    try{
      const common={category:$("#upload-category").value,author:$("#upload-author").value,year:$("#upload-year").value,force:$("#upload-force").checked};
      const items=await Promise.all(selected.map(async file=>({
        ...common,originalName:file.name,
        title:file.name.replace(/^\d{4}(?:_\d{4})?_?/,"").replace(/_/g," ").replace(/\.md$/i,""),
        content:await file.text()
      })));
      const response=await request("/api/upload-batch",{method:"POST",body:JSON.stringify({libraryId:$("#upload-library").value,items})});
      const rejected=response.rejected || [];
      result("#upload-result",`${response.created.length} obras incorporadas.${rejected.length?`\n${rejected.length} rechazadas por duplicidad o validación:\n${rejected.map(item=>`• ${item.originalName}: ${item.error}`).join("\n")}`:""}\nReconstruyendo Atlas…`,Boolean(rejected.length));
      await rebuildAndReload(`${response.created.length} obras incorporadas y publicadas.`);
      $("#upload-form").reset(); $("#upload-queue").innerHTML="";
    }catch(error){
      const rejected=error.data?.rejected || [];
      const detail=rejected.map(item=>`${item.originalName}: ${item.error}`).join("\n");
      result("#upload-result",`${error.message}${detail?`\n${detail}`:""}`,true);
    }finally{submit.disabled=false;submit.textContent="Incorporar el lote";}
  });
  $("#file-list").addEventListener("click",async event=>{
    const rename=event.target.closest("[data-rename-file]");
    if(rename){
      const title=prompt("Nuevo título del documento:",rename.dataset.fileTitle);
      if(!title||title.trim()===rename.dataset.fileTitle)return;
      await request("/api/files/rename",{method:"POST",body:JSON.stringify({libraryId:$("#file-library").value,file:rename.dataset.renameFile,title:title.trim()})});
      toast("Documento renombrado conservando su identificador.");await loadFiles();await loadStatus();return;
    }
    const button=event.target.closest("[data-delete-file]"); if(!button)return;
    if(!confirm(`¿Eliminar ${button.dataset.deleteFile} de la carpeta?`))return;
    await request("/api/delete",{method:"POST",body:JSON.stringify({libraryId:$("#file-library").value,file:button.dataset.deleteFile,confirm:true})});
    toast("Documento movido a la papelera local."); await loadStatus();
  });
  $("#scan-duplicates").addEventListener("click",async()=>{
    $("#duplicate-results").innerHTML="<p>Comparando todas las fuentes. Este análisis sí lee el contenido completo y puede tardar unos segundos…</p>";
    const report=await request("/api/duplicates");
    const groups=[["Contenido idéntico",report.exact],["Título coincidente",report.titles]];
    $("#duplicate-results").innerHTML=groups.map(([title,items])=>`<section><h2>${title} · ${items.length}</h2>${items.map(group=>`<article class="duplicate-group"><h3>${esc(group[0].title)}</h3><ul>${group.map(item=>`<li>${esc(item.library)} · ${esc(item.file)}</li>`).join("")}</ul></article>`).join("")||"<p>Sin coincidencias.</p>"}</section>`).join("");
  });
  $("#library-form").addEventListener("submit",async event=>{
    event.preventDefault();
    try{
      const created=await request("/api/libraries",{method:"POST",body:JSON.stringify({
        short:$("#library-short").value,description:$("#library-description").value,notebookUrl:$("#library-url").value,
        mark:$("#library-mark").value,tone:$("#library-tone").value
      })});
      result("#library-result",`Creada ${created.folder}. Sincronizando Atlas…`);
      $("#library-form").reset();
      await rebuildAndReload("Nueva IA creada y preparada en dist.");
    }catch(error){result("#library-result",error.message,true)}
  });
  $("#library-list").addEventListener("click",async event=>{
    const article=event.target.closest("[data-library-id]"); if(!article)return;
    const form=article.querySelector(".library-edit");
    if(event.target.closest("[data-toggle-library]")){
      form.hidden=!form.hidden;
      event.target.closest("[data-toggle-library]").textContent=form.hidden?"Configurar":"Cerrar";
      return;
    }
    if(event.target.closest("[data-delete-library]")){
      const library=libraryRegistry.find(item=>item.id===article.dataset.libraryId);
      const count=status.libraries.find(item=>item.id===library.id)?.documents || 0;
      const typed=prompt(`Esta acción eliminará “${library.short}”, su carpeta y ${count} documentos. Escribe el nombre completo para confirmar:`);
      if(typed===null)return;
      const output=article.querySelector("[data-library-result]");
      if(typed.trim()!==library.short){output.textContent="El nombre escrito no coincide. No se ha eliminado nada.";output.classList.add("error");return;}
      if(!confirm(`Última confirmación: ¿eliminar definitivamente ${library.short} y todos sus documentos?`))return;
      try{
        await request(`/api/libraries/${encodeURIComponent(library.id)}`,{method:"DELETE",body:JSON.stringify({
          confirmDelete:true,confirmName:typed,deleteDocuments:true
        })});
        await rebuildAndReload(`${library.short} eliminada localmente y salida reconstruida.`);
      }catch(error){output.textContent=error.message;output.classList.add("error");}
    }
  });
  $("#library-list").addEventListener("submit",async event=>{
    const form=event.target.closest(".library-edit"); if(!form)return;
    event.preventDefault();
    const article=form.closest("[data-library-id]");
    const output=form.querySelector("[data-library-result]");
    output.textContent="Guardando y sincronizando…"; output.classList.remove("error");
    const values=Object.fromEntries(new FormData(form));
    try{
      await request(`/api/libraries/${encodeURIComponent(article.dataset.libraryId)}`,{method:"PATCH",body:JSON.stringify(values)});
      await rebuildAndReload("Configuración de la IA actualizada.");
    }catch(error){output.textContent=error.message;output.classList.add("error");}
  });
  $$("[data-save-editor]").forEach(button=>button.addEventListener("click",async()=>{
    const type=button.dataset.saveEditor;
    try{
      const items=JSON.parse($(`#${type}-editor`).value);
      await request(`/api/${type==="external"?"external":"shorts"}`,{method:"POST",body:JSON.stringify({items})});
      result(`#${type}-result`,`${items.length} elementos guardados.`); toast("Base editorial guardada.");
    }catch(error){result(`#${type}-result`,error.message,true)}
  }));
  $("#refresh-external").addEventListener("click",async()=>{
    $("#refresh-external").disabled=true; $("#refresh-external").textContent="Consultando…";
    try{await request("/api/refresh-external",{method:"POST",body:"{}"});toast("Tarjetas externas actualizadas.");}
    finally{$("#refresh-external").disabled=false;$("#refresh-external").textContent="Consultar enlaces ahora";}
  });
  $("#save-providers").addEventListener("click",async()=>{
    try{
      const payload={
        youtube:JSON.parse($("#provider-youtube").value),
        music:JSON.parse($("#provider-music").value),
        instagram:JSON.parse($("#provider-instagram").value)
      };
      await request("/api/providers",{method:"POST",body:JSON.stringify(payload)});
      result("#providers-result","Configuración guardada en las fuentes. Queda pendiente construir Atlas.");
      await loadStatus();
    }catch(error){result("#providers-result",error.message,true)}
  });
  $("#validate").addEventListener("click",async()=>{
    $("#validate").disabled=true;
    try{
      const response=await request("/api/validate",{method:"POST",body:"{}"});
      toast("Validación completada.");
      $("#publication-output").textContent=response.output||"Validación correcta.";
    }catch(error){toast(error.message)}
    finally{$("#validate").disabled=false}
  });
  $("#run-audit").addEventListener("click",()=>renderAudit().catch(error=>toast(error.message)));
  $("#prepare-release").addEventListener("click",async()=>{
    $("#prepare-release").disabled=true;$("#publication-output").textContent="Construyendo y validando dist…";
    try{
      const response=await request("/api/rebuild",{method:"POST",body:JSON.stringify({force:true,external:false})});
      if(!response.ok)throw new Error(response.message||"No se pudo construir.");
      $("#publication-output").textContent=(response.output||[]).join("\n\n");
      await Promise.all([loadStatus(),renderAudit()]);
      toast("dist está preparado. No se ha subido nada.");
    }catch(error){$("#publication-output").textContent=error.message;toast(error.message)}
    finally{$("#prepare-release").disabled=false}
  });
  $("#rebuild").addEventListener("click",async()=>{
    $("#rebuild").disabled=true;$("#rebuild").textContent="Reconstruyendo…";$("#server-state").textContent="Actualizando catálogo y buscador…";
    try{const response=await request("/api/rebuild",{method:"POST",body:JSON.stringify({force:false})});toast(response.ok?"Atlas actualizado.":"No se pudo actualizar.");await loadStatus();}
    catch(error){toast(error.message)}finally{$("#rebuild").disabled=false;$("#rebuild").textContent="Construir y preparar";}
  });
  Promise.all([loadStatus(),loadEditors(),renderAudit()]).catch(error=>toast(error.message));
})();
