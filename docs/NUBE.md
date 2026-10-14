# Conectar el sistema a la nube (datos compartidos)

Sin esto, cada navegador guarda **su propia copia**: dos usuarios ven números distintos. Con la nube, todos leen y escriben en el mismo lugar.

## Opción recomendada: Google Sheets (un Excel en tu Drive)

No usa ningún servicio de pago ni toca otros sistemas. Los datos quedan en una hoja de cálculo tuya.

1. Crea una hoja de cálculo nueva en Google Drive (ej. "ALR datos").
2. **Extensiones → Apps Script**. Borra lo que haya y pega el contenido de [`apps-script/Code.gs`](apps-script/Code.gs) (también está en **Configuración → Nube** dentro del sistema).
3. **Configuración del proyecto (engrane) → Propiedades de la secuencia de comandos → Agregar propiedad**: nombre `CLAVE`, valor una contraseña que tú elijas.
4. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: *Yo*. Quién tiene acceso: *Cualquier persona*. Autoriza permisos y copia la URL que termina en `/exec`.
5. En el sistema (PIN de LANCER) → **Configuración → Nube**, elige *Google Sheets*, pega la URL y la clave, y presiona **Probar y conectar**.
6. Copia el **enlace para unir equipos** y ábrelo en los otros teléfonos/computadoras.

Límites: latencia de 1–3 s, actualiza cada ~10 s, cuota diaria de Google, seguridad de demo (quien tenga el enlace tiene acceso).

## Opción avanzada: Supabase

1. Crea un proyecto gratis en https://supabase.com.
2. Abre **SQL Editor**, pega este texto y presiona **Run**:

```sql
create table if not exists alr_items(
  id text primary key, kind text not null, data jsonb not null,
  u bigint not null default 0, s bigint not null default 0);
create index if not exists alr_items_s on alr_items(s);
create or replace function alr_touch() returns trigger language plpgsql as $$
begin new.s := (extract(epoch from clock_timestamp())*1000000)::bigint; return new; end $$;
drop trigger if exists alr_touch on alr_items;
create trigger alr_touch before insert or update on alr_items for each row execute function alr_touch();
create table if not exists alr_seq(k text primary key, v bigint not null);
create or replace function next_seq(p_k text, p_start bigint) returns bigint language plpgsql as $$
declare r bigint; begin
  insert into alr_seq(k,v) values (p_k,p_start)
  on conflict (k) do update set v = alr_seq.v + 1 returning v into r;
  return r; end $$;
alter table alr_items enable row level security;
alter table alr_seq enable row level security;
create policy "alr_items_todo" on alr_items for all using (true) with check (true);
create policy "alr_seq_todo" on alr_seq for all using (true) with check (true);
```

3. En **Project Settings → API** copia la *Project URL* y la llave *anon public*.
4. En el sistema entra con el PIN de LANCER → **Configuración → Nube**, pega ambas y presiona **Probar y conectar**.
5. Presiona **Copiar enlace para mis compañeros**. Quien abra ese enlace queda conectado y ve los mismos datos.

Notas
- Conexión de demostración: cualquiera con el enlace puede leer y escribir. Para producción se agregan usuarios con contraseña y permisos por perfil.
- Los folios (pedidos, guías, facturas) los asigna la nube, así que dos personas no repiten número.
- Solo funciona desde la página web (GitHub Pages), no desde la vista previa de claude.ai.
