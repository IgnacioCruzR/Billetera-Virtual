param(
    [switch]$Persistence,
    [switch]$Frontend,
    [ValidateRange(1,65535)][int]$FrontendPort = 8080,
    [string]$ProjectName,
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$databases = [ordered]@{
    'postgres-usuarios' = 'billetera_usuarios'
    'postgres-transacciones' = 'billetera_transacciones'
    'postgres-notificaciones' = 'billetera_notificaciones'
}
$services = @($databases.Keys) + 'kafka'
$probe = [Guid]::NewGuid().ToString('N')
$topic = "billetera-infra-smoke-$probe"
$table = "infra_smoke_$probe"
$createdTables = @()
$createdTopic = $false
$composeOptions = @()
if ($ProjectName) { $composeOptions += @('--project-name', $ProjectName) }
if ($EnvFile) { $composeOptions += @('--env-file', (Resolve-Path -LiteralPath $EnvFile).Path) }

function Invoke-Compose([string[]]$Arguments, [string]$InputLine) {
    if ($InputLine) { $InputLine | & docker compose @composeOptions @Arguments }
    else { & docker compose @composeOptions @Arguments }
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($Arguments[0]) terminó con código $LASTEXITCODE" }
}

function Invoke-DatabaseShell([string]$ServiceName, [string]$Script) {
    # Preserve shell quotes when PowerShell 5 passes arguments to docker.exe.
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($Script -replace "`r", '')))
    Invoke-Compose @('exec', '-T', $ServiceName, 'sh', '-ec', "echo $encoded | base64 -d | sh -e")
}

function Invoke-Database([string]$ServiceName, [string]$Sql) {
    $shell = @'
export PGPASSWORD="$POSTGRES_PASSWORD"
psql -XAtq -h OWN_DNS -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'BILLETERA_SQL'
'@
    Invoke-DatabaseShell $ServiceName "$($shell.Replace('OWN_DNS', $ServiceName))`n$Sql`nBILLETERA_SQL`n"
}

function Invoke-Kafka([string]$Tool, [string[]]$Options, [string]$InputLine) {
    Invoke-Compose (@('exec', '-T', '-e', 'KAFKA_HEAP_OPTS=-Xms64m -Xmx128m', 'kafka', "/opt/kafka/bin/$Tool.sh", '--bootstrap-server', 'kafka:9092', '--topic', $topic) + $Options) $InputLine
}

function Assert-Message {
    $messages = @(Invoke-Kafka 'kafka-console-consumer' @('--from-beginning', '--max-messages', '1', '--timeout-ms', '20000'))
    if ($messages -cnotcontains $probe) { throw 'Kafka no devolvió el mensaje de prueba.' }
}

Push-Location -LiteralPath $root
try {
    Invoke-Compose @('--profile', 'frontend', 'config', '--quiet')
    $identities = foreach ($service in $databases.Keys) {
        $output = @(Invoke-Database $service @"
select current_database();
select current_user;
select count(*) from pg_database
where datname in ('billetera_usuarios','billetera_transacciones','billetera_notificaciones')
and datname <> current_database();
"@)
        if ($output.Count -ne 3 -or $output[0] -ne $databases[$service] -or $output[2] -ne '0') {
            throw "Conexión o aislamiento falló en $service"
        }
        $others = ($databases.Keys | Where-Object { $_ -ne $service }) -join ' '
        $isolation = @'
if PGPASSWORD=PROBE psql -w -X -h OWN_DNS -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'select 1' >/dev/null 2>&1; then
    echo 'PostgreSQL aceptó una contraseña incorrecta' >&2
    exit 1
fi
for peer in PEERS; do
    if getent hosts "$peer" >/dev/null; then
        echo 'Una instancia PostgreSQL puede resolver otra base' >&2
        exit 1
    fi
done
'@
        Invoke-DatabaseShell $service ($isolation.Replace('OWN_DNS', $service).Replace('PROBE', $probe).Replace('PEERS', $others))
        Write-Host "$service autenticación, base propia y aislamiento DNS verificados"
        $output[1]
    }
    if (@($identities | Sort-Object -Unique).Count -ne 3) { throw 'PostgreSQL requiere tres usuarios distintos.' }

    Invoke-Kafka 'kafka-topics' @('--create', '--partitions', '1', '--replication-factor', '1')
    $createdTopic = $true
    Invoke-Kafka 'kafka-console-producer' @('--command-property', 'acks=all') $probe
    Assert-Message
    Write-Host 'Kafka producción y consumo verificados en un tópico de infraestructura.'

    if ($Persistence) {
        foreach ($service in $databases.Keys) {
            Invoke-Database $service "create table $table (marker text primary key);"
            $createdTables += $service
            Invoke-Database $service "insert into $table values ('$probe');"
        }
        Invoke-Compose (@('restart') + $services)
        Invoke-Compose (@('up', '-d', '--no-recreate', '--wait', '--wait-timeout', '150') + $services)
        foreach ($service in $databases.Keys) {
            if ((Invoke-Database $service "select marker from $table;") -cne $probe) {
                throw "PostgreSQL perdió el marcador después de reiniciar $service"
            }
        }
        Assert-Message
        Write-Host 'Persistencia verificada después de reiniciar PostgreSQL y Kafka.'
    }

    if ($Frontend) {
        & node (Join-Path $root 'frontend/scripts/container-smoke.mjs') $FrontendPort
        if ($LASTEXITCODE -ne 0) { throw "Verificación de Nginx terminó con código $LASTEXITCODE" }
    }
} finally {
    try {
        foreach ($service in $createdTables) { Invoke-Database $service "drop table $table;" }
        if ($createdTopic) { Invoke-Kafka 'kafka-topics' @('--delete') }
    } finally {
        Pop-Location
    }
}
