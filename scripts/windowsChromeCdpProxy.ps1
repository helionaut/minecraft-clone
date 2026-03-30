param(
  [string]$ListenAddress = "0.0.0.0",
  [int]$ListenPort = 9333,
  [string]$TargetAddress = "127.0.0.1",
  [int]$TargetPort = 9222
)

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($ListenAddress), $ListenPort)
$listener.Start()
Write-Output "proxy-listening:${ListenAddress}:${ListenPort}->${TargetAddress}:${TargetPort}"

function Start-Bridge($client) {
  $server = [System.Net.Sockets.TcpClient]::new($TargetAddress, $TargetPort)
  $clientStream = $client.GetStream()
  $serverStream = $server.GetStream()

  $copy = {
    param($inputStream, $outputStream)
    $buffer = New-Object byte[] 8192
    try {
      while (($read = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $outputStream.Write($buffer, 0, $read)
        $outputStream.Flush()
      }
    } catch {
    }
  }

  $jobA = [System.Threading.Tasks.Task]::Run([Action] { & $copy $clientStream $serverStream })
  $jobB = [System.Threading.Tasks.Task]::Run([Action] { & $copy $serverStream $clientStream })
  [System.Threading.Tasks.Task]::WaitAny(@($jobA, $jobB)) | Out-Null

  $client.Close()
  $server.Close()
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    [System.Threading.Tasks.Task]::Run([Action] { Start-Bridge $client }) | Out-Null
  }
} finally {
  $listener.Stop()
}
