$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$outDir = 'D:\London_School\deliverables'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$outFile = Join-Path $outDir 'London_School_Project_Time_Estimate.docx'
$parts = [System.Collections.Generic.List[string]]::new()
function Esc([string]$s) { [System.Security.SecurityElement]::Escape($s) }
function Para([string]$text, [string]$style = 'Normal') {
    $parts.Add('<w:p><w:pPr><w:pStyle w:val="' + $style + '"/></w:pPr><w:r><w:t xml:space="preserve">' + (Esc $text) + '</w:t></w:r></w:p>')
}
function BreakPage { $parts.Add('<w:p><w:r><w:br w:type="page"/></w:r></w:p>') }
function Table($rows, $widths) {
    $xml = '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D6DEE8"/><w:left w:val="single" w:sz="4" w:color="D6DEE8"/><w:bottom w:val="single" w:sz="4" w:color="D6DEE8"/><w:right w:val="single" w:sz="4" w:color="D6DEE8"/><w:insideH w:val="single" w:sz="4" w:color="D6DEE8"/><w:insideV w:val="single" w:sz="4" w:color="D6DEE8"/></w:tblBorders><w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:left w:w="95" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="95" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'
    foreach ($width in $widths) { $xml += '<w:gridCol w:w="' + $width + '"/>' }
    $xml += '</w:tblGrid>'
    for ($i = 0; $i -lt $rows.Count; $i++) {
        $xml += '<w:tr><w:trPr><w:cantSplit/>'
        if ($i -eq 0) { $xml += '<w:tblHeader/>' }
        $xml += '</w:trPr>'
        for ($j = 0; $j -lt $rows[$i].Count; $j++) {
            $shade = if ($i -eq 0) { '17365D' } elseif ($i % 2 -eq 0) { 'F0F4F8' } else { 'FFFFFF' }
            $color = if ($i -eq 0) { 'FFFFFF' } else { '253247' }
            $bold = if ($i -eq 0) { '<w:b/>' } else { '' }
            $xml += '<w:tc><w:tcPr><w:tcW w:w="' + $widths[$j] + '" w:type="dxa"/><w:shd w:fill="' + $shade + '"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:after="35"/></w:pPr><w:r><w:rPr>' + $bold + '<w:color w:val="' + $color + '"/><w:sz w:val="19"/></w:rPr><w:t>' + (Esc $rows[$i][$j]) + '</w:t></w:r></w:p></w:tc>'
        }
        $xml += '</w:tr>'
    }
    $parts.Add($xml + '</w:tbl>')
}

Para 'LONDON SCHOOL' 'Subtitle'
Para 'Website & CRM Time Estimate' 'Title'
Para 'Prepared 21 November 2026 | One developer | Planning estimate' 'Subtitle'
Para 'Estimated delivery' 'Heading1'
Para 'Allow approximately 8-14 working weeks at 6 focused hours per day, 5 days per week. A reasonable middle planning allowance is 10-11 weeks, provided access and content arrive on time.'
Para 'The task estimates total 192-328 hours. With a separate 20% contingency for unexpected integration issues and revisions, the planning budget is approximately 231-394 hours, or 39-66 working days. External waiting time is additional.'
Para 'What this estimate is based on' 'Heading1'
Para 'The handwritten list includes main-domain migration, an alumni page, payment gateway, SSLCommerz, product addition, login, user management, invoice generation, CRM lead CRUD, and lead search. The priority marking is unclear, so the implementation order below follows technical dependencies.'
Para 'The estimate assumes one developer who can work on the existing website but has not previously built invoicing or payment gateway integrations. Learning, prototyping, debugging, and feature-level testing are included in each relevant estimate.'
Para 'Existing work reduces the scope' 'Heading1'
Para 'A limited code review found sign-in and dashboard pages in D:\London_School\frontend. D:\CRM contains authentication, employee management, lead creation, editing, deletion, and search code. These are foundations to verify and finish; code presence does not establish that they work correctly in production.'
Para 'The estimate assumes the D:\CRM backend can be reused. If it cannot, or a separate student portal is required, login, user management, and CRM work need a new estimate.'
Para 'Key assumptions' 'Heading1'
Para 'One existing website and backend; one main domain; one approved design direction; a small course/product catalog; one-time payments through SSLCommerz; a basic PDF invoice; existing staff/admin roles; and one consolidated review round. This estimates development time, not a service price.'

BreakPage
Para '01. Time for each part' 'Heading1'
Para 'A working day means 6 focused hours. Ranges below are active effort, not elapsed calendar time. Final cross-feature testing is listed separately.'
$rows = @(
    ,@('Task', 'Hours', 'Days*', 'Included work')
    ,@('Main-domain migration', '12-20', '2-3.3', 'Hosting/domain audit, configuration, environment variables, DNS, HTTPS, redirects, form checks and rollback preparation.')
    ,@('Alumni page', '12-20', '2-3.3', 'One responsive page, reusable alumni cards, placeholders, then one approved batch of up to 12 profiles.')
    ,@('Product addition', '18-30', '3-5', 'Basic admin add/edit/archive, title, description, image, price and a simple public listing/detail view.')
    ,@('Login system', '12-24', '2-4', 'Review existing sign-in, sessions, logout, protected routes, access checks and deployment configuration.')
    ,@('User management', '18-30', '3-5', 'Complete existing staff/admin list, add/edit, roles, activation/deactivation and server-side access checks.')
    ,@('Invoice generation', '30-48', '5-8', 'Learn PDF generation; invoice data, numbering, totals, template, download and verified-payment status link.')
    ,@('Payment gateway: site workflow', '18-30', '3-5', 'Learn checkout flow; order records, authoritative prices, pending/paid/failed/cancelled states and customer result pages.')
    ,@('SSLCommerz: provider integration', '36-60', '6-10', 'Learn API; sandbox checkout, validation, IPN, duplicate handling, callback checks and live configuration/testing.')
    ,@('CRM lead CRUD', '12-24', '2-4', 'Verify and complete existing create/list/view/edit/delete flows, validation and role restrictions.')
    ,@('Lead search', '6-12', '1-2', 'Verify existing name/email/phone search, filters, paging and empty states against backend data.')
    ,@('Final testing and handover', '18-30', '3-5', 'End-to-end checks across features, mobile review, production smoke tests, fixes and operating notes.')
    ,@('BASE TOTAL', '192-328', '32-55', 'Feature learning and testing are already included; contingency is added below.')
)
Table $rows @(2150,850,850,5650)
Para '* Individual day ranges are approximate. Total days are calculated from total hours, not rounded row values.' 'Small'
Para 'Add 20% contingency: approximately 39-66 working days total, or 8-14 working weeks. Payment gateway and SSLCommerz are two work packages within ONE payment integration; no second provider is included.'

BreakPage
Para '02. Scope, learning and dependencies' 'Heading1'
Para 'Payments: allow 54-90 hours together' 'Heading2'
Para 'Start with a small sandbox prototype before connecting checkout to real orders. The website workflow covers what is being purchased and how order status is stored. The SSLCommerz work covers communication with the provider, verification and notifications.'
Para 'A successful browser redirect alone must not mark an order paid. Confirm the transaction on the server, check the amount and currency, and handle repeated notifications without issuing duplicate invoices. Test success, failure, cancellation, invalid amounts, duplicate callbacks, delayed notification and a customer closing the browser.'
Para 'The official SSLCommerz documentation describes separate sandbox/live credentials, transaction validation and IPN notifications. Those requirements explain the integration allowance; the time ranges are planning judgments, not provider estimates. Source: https://developer.sslcommerz.com/doc/v4/'
Para 'Invoice generation: allow 30-48 hours' 'Heading2'
Para 'Agree one invoice template before implementation: business details, logo, customer information, line items, currency, totals, numbering and payment status. Keep an immutable invoice record and connect paid status to verified payments. Include PDF download and a basic admin view.'
Para 'This assumes the client supplies approved pricing and tax rules. It does not include accounting software, jurisdiction-specific tax certification, recurring billing, instalment schedules, credit notes or a refund management system. Emailing invoice PDFs automatically is additional scope.'
Para 'Alumni page: allow 12-20 hours of work; content waiting is separate' 'Heading2'
Para 'Build the layout using clearly marked placeholders first. Final publication needs approved photos, names, qualifications or completion years, current roles, short biographies/testimonials and permission to publish. The estimate includes placing up to 12 approved profiles in one batch.'
Para 'No delivery date should be promised for the finished alumni page until those materials are supplied. Photo shoots, interviews, writing biographies from scratch, extensive photo editing and a separate alumni content-management system are excluded.'
Para 'Access needed before launch' 'Heading2'
Para 'Domain registrar/DNS and hosting access; the intended production project and main domain; backend/database access; production environment variable values; Firebase/authentication configuration where applicable; email credentials; and SSLCommerz sandbox/live merchant access.'
Para 'Merchant onboarding, approval, credential delivery, client review and DNS/certificate waiting are external dependencies. Their duration has not been verified and is not included in active development hours. Hosting, domain and provider charges are also excluded.'

BreakPage
Para '03. Delivery order and completion checks' 'Heading1'
Para 'Recommended sequence' 'Heading2'
Para '1. Audit and prepare migration. Confirm the authoritative codebase, main domain, deployment projects, database, access and backups. Request alumni content and merchant access immediately.'
Para '2. Stabilise the existing foundations. Complete login, staff/admin permissions, CRM CRUD and search. Prepare the alumni layout while waiting for content.'
Para '3. Add products and financial records. Agree the product model, order status flow and invoice template. Run a small SSLCommerz sandbox prototype early to expose integration issues.'
Para '4. Connect and test payments. Complete checkout, validation and notifications; link verified payments to invoices. Switch to live credentials only after sandbox acceptance and merchant readiness.'
Para '5. Complete release and handover. Insert approved alumni materials, run cross-feature checks and release to the main domain. If the public website must launch sooner, use a separate migration release and keep payment work in staging until ready.'
Para 'How the schedule changes with available time' 'Heading2'
Table @(
    ,@('Focused time per day', 'Approximate duration, with contingency')
    ,@('4 hours, 5 days/week', '58-99 working days / about 12-20 weeks')
    ,@('6 hours, 5 days/week', '39-66 working days / about 8-14 weeks')
    ,@('8 hours, 5 days/week', '29-50 working days / about 6-10 weeks')
) @(3600,5900)
Para 'These ranges assume the same scope and uninterrupted availability. External waits can overlap other work, but a missing dependency can still delay the final release.'
Para 'Completion checks' 'Heading2'
Para 'Migration: main domain and HTTPS work; existing URLs redirect correctly; contact and brochure forms still deliver; authentication and API connections work in production; rollback notes exist.'
Para 'Access and CRM: signed-out users cannot access protected data; roles are enforced by the server; lead create/edit/delete and search return correct results; unauthorised operations fail.'
Para 'Products, payments and invoices: prices come from the server; order states remain consistent; verified payments create one invoice; totals and PDF download are correct; duplicate and unsuccessful payments cannot unlock a paid order.'
Para 'Alumni: approved content and publication permissions are present; layout and images work on mobile; no placeholder profiles remain on the final page.'
Para 'Scope points that could change the estimate' 'Heading2'
Para '“Product Add” is interpreted as a small course/product catalog, not a full store with stock, shipping or coupons. “Login” means completing the existing account flow, not building a new student portal. Automatically converting website contact/brochure submissions into CRM leads is not included; allow roughly 6-12 extra hours if requested.'
Para 'Evidence and limits' 'Heading2'
Para 'Reviewed: the supplied handwritten image; local frontend sign-in/dashboard/search code; D:\CRM backend auth, employee and lead modules; and official SSLCommerz integration documentation (https://developer.sslcommerz.com/doc/v4/). This was a targeted scope review, not a running-system audit. Reconfirm estimates after the initial audit; no live deployment or production account was inspected.' 'Small'

$styles = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/><w:color w:val="253247"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="115" w:line="260" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="100" w:after="200"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="17365D"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="21"/><w:color w:val="617188"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="125"/></w:pPr><w:rPr><w:b/><w:sz w:val="29"/><w:color w:val="17365D"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="155" w:after="85"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="17365D"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Small"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="18"/><w:color w:val="617188"/></w:rPr></w:style></w:styles>
'@
$document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + ($parts -join '') + '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="950" w:bottom="850" w:left="950" w:header="400" w:footer="400"/></w:sectPr></w:body></w:document>'
$files = @{
    '[Content_Types].xml' = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'
    '_rels/.rels' = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    'word/document.xml' = $document
    'word/styles.xml' = $styles
    'word/_rels/document.xml.rels' = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'
    'word/footer1.xml' = '<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/><w:color w:val="617188"/></w:rPr><w:t>London School | Planning estimate | </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>'
}
$fileStream = [System.IO.File]::Open($outFile, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($fileStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($key in $files.Keys) {
        $entry = $archive.CreateEntry($key)
        $writer = [System.IO.StreamWriter]::new($entry.Open(), [System.Text.UTF8Encoding]::new($false))
        try { $writer.Write($files[$key]) } finally { $writer.Dispose() }
    }
} finally { $archive.Dispose(); $fileStream.Dispose() }
$check = [System.IO.Compression.ZipFile]::OpenRead($outFile)
try {
    foreach ($entry in $check.Entries) {
        $reader = [System.IO.StreamReader]::new($entry.Open())
        try { $null = [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
    }
    Write-Output ('Created and XML-validated: ' + $outFile)
    Write-Output ('Package entries: ' + $check.Entries.Count)
} finally { $check.Dispose() }
