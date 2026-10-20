{{- define "northern-lights.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "northern-lights.fullname" -}}
{{- if contains .Chart.Name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- define "northern-lights.selectorLabels" -}}
app.kubernetes.io/name: {{ include "northern-lights.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "northern-lights.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{ include "northern-lights.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "northern-lights.claimName" -}}
{{- .Values.persistence.existingClaim | default (printf "%s-data" (include "northern-lights.fullname" .)) }}
{{- end }}
