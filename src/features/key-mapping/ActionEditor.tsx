import { useState } from 'react';
import { Animated, ScrollView, Switch, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react-native';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { CONTROLS, controlLabel, type Binding, type Point, type Step } from './model';
import { MappingButton, mappingColors, mappingStyles, useMappingTransition } from './MappingUi';

export function MappingField({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean }) {
  const { s } = useUi();
  return <View style={{ minWidth: s(72), flexGrow: 1, flexShrink: 1, gap: s(4) }}><T size={9} color={mappingColors.muted}>{label}</T><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} selectTextOnFocus={numeric} style={{ color: mappingColors.text, backgroundColor: mappingColors.raised, padding: s(8), fontSize: s(11), borderRadius: s(6), borderWidth: 1, borderColor: mappingColors.border, minHeight: 40 }} /></View>;
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState({ value, text: String(value) });
  if (!Object.is(draft.value, value)) setDraft({ value, text: Number.isFinite(value) ? String(value) : '' });
  return <MappingField label={label} value={draft.text} numeric onChange={text => { const next = text.trim() === '' ? NaN : Number(text.replace(',', '.')); setDraft({ value: next, text }); onChange(next); }} />;
}
const DEFAULT_POINT = { x: 0.5, y: 0.5 };
export function makeStep(type: Step['type'], point: Point = DEFAULT_POINT): Step {
  if (type === 'wait') return { type, durationMs: 300 };
  if (type === 'random') return { type, minMs: 1000, maxMs: 5000 };
  if (type === 'double') return { type, point, durationMs: 50, intervalMs: 150 };
  if (type === 'drag') return { type, point, end: { x: Math.min(1, point.x + 0.2), y: point.y }, durationMs: 600, initialHoldMs: 0 };
  return { type, point, durationMs: type === 'hold' ? 2000 : 50 };
}
const STEP_LABELS: Record<Step['type'], string> = { tap: 'Chạm', hold: 'Giữ', double: 'Chạm đôi', wait: 'Chờ', random: 'Chờ ngẫu nhiên', drag: 'Kéo / vuốt' };

export function ActionEditor({ binding, onChange, onClose, onDelete, onPick }: {
  binding: Binding; onChange: (binding: Binding) => void; onClose: () => void; onDelete: () => void;
  onPick: (index: number, end: boolean) => void;
}) {
  const { s, width } = useUi();
  const { progress, close } = useMappingTransition(200);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const updateStep = (index: number, next: Step) => onChange({ ...binding, steps: binding.steps.map((s, i) => i === index ? next : s) });
  const preset = (kind: Step['type'] | 'delay' | 'range') => onChange({ ...binding, physicalHold: false, steps: kind === 'delay' ? [makeStep('wait'), makeStep('tap', binding.point)] : kind === 'range' ? [makeStep('random'), makeStep('tap', binding.point)] : [makeStep(kind, binding.point)] });
  const actionName = binding.steps.length === 1 ? STEP_LABELS[binding.steps[0].type] : 'Macro';
  return <Animated.View style={{ position: 'absolute', right: s(6), top: s(6), bottom: s(6), width: Math.min(s(238), width - 32), zIndex: 50,
    backgroundColor: mappingColors.panel, borderRadius: s(9), borderWidth: 1, borderColor: mappingColors.border,
    opacity: progress, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(10), paddingVertical: s(5), gap: s(8) }}><T size={11} color={mappingColors.text} weight="semibold" style={{ flex: 1 }}>Cài đặt nút</T><MappingButton label="Đóng thuộc tính nút" onPress={() => close(onClose)} style={{ borderWidth: 0, backgroundColor: 'transparent' }}><X size={s(13)} color={mappingColors.muted} /></MappingButton></View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: s(10), paddingTop: 0, gap: s(10) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}><T size={9.5} color={mappingColors.muted} style={{ flex: 1 }}>Nút</T><MappingButton label="Chọn tổ hợp nút" onPress={() => setControlsOpen(value => !value)} style={{ width: '62%' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}><T size={10.5} color={mappingColors.text} style={{ flex: 1 }}>{binding.controls.map(controlLabel).join(' + ')}</T><ChevronDown size={s(12)} color={mappingColors.muted} /></View></MappingButton></View>
        {controlsOpen ? <><T size={9} color={mappingColors.muted}>Tổ hợp kích hoạt · tối đa 4 nút</T><View style={mappingStyles.row}>{CONTROLS.map(control => <MappingButton key={control} active={binding.controls.includes(control)} onPress={() => {
          const next = binding.controls.includes(control) ? binding.controls.filter(c => c !== control) : [...binding.controls, control];
          if (next.length && next.length <= 4) onChange({ ...binding, controls: next });
        }}>{controlLabel(control)}</MappingButton>)}</View></> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}><T size={9.5} color={mappingColors.muted} style={{ flex: 1 }}>Hành động</T><MappingButton label="Chọn hành động" onPress={() => setPresetsOpen(value => !value)} style={{ width: '62%' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}><T size={10} color={mappingColors.text} style={{ flex: 1 }}>{actionName}</T><ChevronDown size={s(12)} color={mappingColors.muted} /></View></MappingButton></View>
        {presetsOpen ? <View style={mappingStyles.row}>{(['tap', 'hold', 'double', 'drag', 'delay', 'range'] as const).map(kind => <MappingButton key={kind} onPress={() => { preset(kind); setPresetsOpen(false); setExpandedStep(null); }}>{kind === 'delay' ? 'Chạm trễ' : kind === 'range' ? 'Range Click' : STEP_LABELS[kind]}</MappingButton>)}</View> : null}
        {binding.steps.length === 1 && binding.steps[0].type !== 'random' ? <NumberField label="Thời gian (ms)" value={binding.steps[0].durationMs} onChange={durationMs => updateStep(0, { ...binding.steps[0], durationMs } as Step)} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), borderTopWidth: 1, borderTopColor: mappingColors.border, paddingTop: s(10) }}><T size={10.5} color={mappingColors.text} weight="semibold" style={{ flex: 1 }}>Macro</T><MappingButton disabled={binding.steps.length >= 32} onPress={() => setAddOpen(value => !value)}><View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}><Plus size={s(12)} color={mappingColors.text} /><T size={9} color={mappingColors.text}>Thêm bước</T></View></MappingButton></View>
        {addOpen ? <View style={mappingStyles.row}>{(Object.keys(STEP_LABELS) as Step['type'][]).map(type => <MappingButton key={type} onPress={() => { onChange({ ...binding, physicalHold: false, steps: [...binding.steps, makeStep(type, binding.point)] }); setExpandedStep(binding.steps.length); setAddOpen(false); }}>{STEP_LABELS[type]}</MappingButton>)}</View> : null}
        {binding.steps.map((step, index) => <View key={index} style={{ backgroundColor: mappingColors.raised, borderRadius: s(6), padding: s(5), gap: s(7) }}>
          <MappingButton label={`Sửa bước ${index + 1}`} onPress={() => setExpandedStep(expandedStep === index ? null : index)} style={{ borderWidth: 0, paddingHorizontal: s(4), backgroundColor: 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}><T size={9} color={mappingColors.muted}>{index + 1}</T><T size={9.5} color={mappingColors.text} style={{ flex: 1 }}>{STEP_LABELS[step.type]}</T><T size={8.5} color={mappingColors.muted}>{step.type === 'random' ? `${step.minMs / 1000}–${step.maxMs / 1000}` : step.durationMs / 1000}s</T><ChevronDown size={s(11)} color={mappingColors.muted} /></View>
          </MappingButton>
          {expandedStep === index ? <>
          <View style={mappingStyles.row}>
            <MappingButton label="Đưa bước lên" disabled={index === 0} onPress={() => { const steps = [...binding.steps]; [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]]; onChange({ ...binding, steps }); setExpandedStep(index - 1); }}><ChevronUp size={s(13)} color={mappingColors.text} /></MappingButton>
            <MappingButton label="Đưa bước xuống" disabled={index === binding.steps.length - 1} onPress={() => { const steps = [...binding.steps]; [steps[index + 1], steps[index]] = [steps[index], steps[index + 1]]; onChange({ ...binding, steps }); setExpandedStep(index + 1); }}><ChevronDown size={s(13)} color={mappingColors.text} /></MappingButton>
            <MappingButton danger disabled={binding.steps.length === 1} onPress={() => { onChange({ ...binding, steps: binding.steps.filter((_, i) => i !== index), physicalHold: false }); setExpandedStep(null); }}>Xóa bước</MappingButton>
          </View>
          <View style={mappingStyles.row}>
            {step.type === 'random' ? <><NumberField label="Min (ms)" value={step.minMs} onChange={minMs => updateStep(index, { ...step, minMs })} /><NumberField label="Max (ms)" value={step.maxMs} onChange={maxMs => updateStep(index, { ...step, maxMs })} /></> : <NumberField label="Thời gian (ms)" value={step.durationMs} onChange={durationMs => updateStep(index, { ...step, durationMs })} />}
            {step.type === 'double' ? <NumberField label="Khoảng cách hai lần (ms)" value={step.intervalMs} onChange={intervalMs => updateStep(index, { ...step, intervalMs })} /> : null}
            {step.type === 'drag' ? <NumberField label="Giữ trước khi kéo (ms)" value={step.initialHoldMs} onChange={initialHoldMs => updateStep(index, { ...step, initialHoldMs })} /> : null}
          </View>
          {'point' in step ? <><View style={mappingStyles.row}><NumberField label="X (0–1)" value={step.point.x} onChange={x => updateStep(index, { ...step, point: { ...step.point, x } })} /><NumberField label="Y (0–1)" value={step.point.y} onChange={y => updateStep(index, { ...step, point: { ...step.point, y } })} /><MappingButton onPress={() => onPick(index, false)}>Đặt trên ảnh</MappingButton></View>
            {step.type === 'drag' ? <View style={mappingStyles.row}><NumberField label="X cuối (0–1)" value={step.end.x} onChange={x => updateStep(index, { ...step, end: { ...step.end, x } })} /><NumberField label="Y cuối (0–1)" value={step.end.y} onChange={y => updateStep(index, { ...step, end: { ...step.end, y } })} /><MappingButton onPress={() => onPick(index, true)}>Đặt điểm cuối</MappingButton></View> : null}</> : null}
          </> : null}
        </View>)}
        <MappingButton onPress={() => setAdvanced(value => !value)}>{advanced ? 'Thu gọn tùy chọn' : 'Tùy chọn nâng cao'}</MappingButton>
        {advanced ? <>
        <MappingField label="Tên thao tác / macro" value={binding.name} onChange={name => onChange({ ...binding, name })} />
        <NumberField label="Số lần lặp (1–20, tối đa 5 phút)" value={binding.repeat} onChange={repeat => onChange({ ...binding, repeat })} />
        {binding.steps.length === 1 && binding.steps[0].type === 'hold' ? <View style={mappingStyles.row}><T size={10} color={mappingColors.muted} style={{ flex: 1 }}>Giữ đến khi nhả nút (tối đa 60 giây)</T><Switch value={binding.physicalHold} onValueChange={physicalHold => onChange({ ...binding, physicalHold, repeat: 1 })} /></View> : null}
        </> : null}
        <MappingButton danger onPress={onDelete}><View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}><Trash2 size={s(13)} color={mappingColors.danger} /><T size={10} color={mappingColors.danger}>Xóa mapping</T></View></MappingButton>
      </ScrollView>
  </Animated.View>;
}
