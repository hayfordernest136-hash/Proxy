$ErrorActionPreference = 'Stop'
$p = 'c:\xampp\htdocs\proxyy2\server\src\controllers\payment.controller.ts'
$c = Get-Content -Path $p -Raw

$old = "import {`r`n  sendOrderReceivedEmail,`r`n  sendPaymentConfirmedEmail,`r`n  sendOrderCompletedEmail,`r`n`r`n} from '../services/order-email.service';"
$new = "import {`r`n  sendOrderReceivedEmail,`r`n  sendPaymentConfirmedEmail,`r`n  sendOrderCompletedEmail,`r`n  sendOrderIssueEmail,`r`n} from '../services/order-email.service';"

if ($c.Contains($old)) {
    $c = $c.Replace($old, $new)
    Set-Content -Path $p -Value $c -NoNewline -Encoding utf8
    Write-Host 'Import block fixed.'
} else {
    Write-Host 'Old import block not found (check line endings).'
    # Fallback: regex replace on the 4-line import block
    $pattern = "(?s)import \{\s*sendOrderReceivedEmail,\s*sendPaymentConfirmedEmail,\s*sendOrderCompletedEmail,\s*\} from '\.\./services/order-email\.service';"
    if ($c -match $pattern) {
        $c = $c -replace $pattern, "import {`r`n  sendOrderReceivedEmail,`r`n  sendPaymentConfirmedEmail,`r`n  sendOrderCompletedEmail,`r`n  sendOrderIssueEmail,`r`n} from '../services/order-email.service';"
        Set-Content -Path $p -Value $c -NoNewline -Encoding utf8
        Write-Host 'Import block fixed via regex.'
    } else {
        Write-Host 'Unable to locate import block.'
    }
}

