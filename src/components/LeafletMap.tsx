import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
import type { LatLng } from '../lib/geo';

// react-native-webview's class typings don't match React 19.3 types yet; runtime is fine.
const WebView = RNWebView as unknown as React.ComponentType<any>;
type WebViewHandle = { injectJavaScript: (js: string) => void };

export type MapMarker = LatLng & {
  id: string;
  kind: 'me' | 'victim' | 'helper' | 'report-red' | 'report-orange';
  label?: string;
  initial?: string;
};

type Props = {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  route?: LatLng[];
  /** Fit all markers in view once (first time there are 2+ markers). */
  fit?: boolean;
  style?: ViewStyle;
};

// Leaflet + standard OpenStreetMap tiles (free, no API key), darkened with a CSS filter.
// Markers are updated in place (no full redraw) to keep the app smooth.
const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;height:100%;background:#0B0D10;}
.leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.85) contrast(.9) saturate(.6);}
.leaflet-control-attribution{background:rgba(0,0,0,.55)!important;color:#8B93A1!important;font:9px sans-serif}
.leaflet-control-attribution a{color:#8B93A1!important}
.me{width:18px;height:18px;border-radius:50%;background:#fff;border:5px solid #2F7BFF;box-shadow:0 0 0 8px rgba(47,123,255,.22);box-sizing:border-box}
.v{width:26px;height:26px;border-radius:50%;background:#E11D22;border:3px solid #fff;color:#fff;font:700 12px sans-serif;display:flex;align-items:center;justify-content:center;box-sizing:border-box;position:relative}
.v:before{content:'';position:absolute;left:-14px;top:-14px;width:48px;height:48px;border-radius:50%;border:2px solid rgba(225,29,34,.7);animation:p 1.8s infinite}
@keyframes p{0%{transform:scale(.5);opacity:1}100%{transform:scale(1.2);opacity:0}}
.dot{width:12px;height:12px;border-radius:50%;border:2px solid #0B0D10}
.lbl{position:absolute;white-space:nowrap;transform:translate(-50%,-140%);left:50%;top:0;padding:3px 8px;border-radius:8px;font:600 11px sans-serif}
.lbl.r{background:#fff;color:#E11D22}.lbl.b{background:#2F7BFF;color:#fff}.lbl.g{background:#30D158;color:#000}
</style></head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([35.8452,10.6152],15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,
 attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
var markers={};var line=null;var fitted=false;var centered=false;
function html(m){
 var lbl=m.label?'<div class="lbl '+(m.kind==='victim'?'r':m.kind==='helper'?'g':'b')+'">'+m.label+'</div>':'';
 var body;
 if(m.kind==='me'){body='<div class="me"></div>';}
 else if(m.kind==='victim'){body='<div class="v">'+(m.initial||'')+'</div>';}
 else if(m.kind==='helper'){body='<div class="dot" style="background:#30D158;width:16px;height:16px"></div>';}
 else {body='<div class="dot" style="background:'+(m.kind==='report-red'?'#E11D22':'#FF9F0A')+'"></div>';}
 return '<div style="position:relative">'+lbl+body+'</div>';
}
function size(k){return k==='victim'?26:k==='me'?18:k==='helper'?16:12;}
window.najda=function(st){
 var seen={};
 (st.markers||[]).forEach(function(m){
  seen[m.id]=1;var h=html(m);var e=markers[m.id];
  if(!e){var s=size(m.kind);
   e=markers[m.id]={h:h,m:L.marker([m.lat,m.lng],{interactive:false,icon:L.divIcon({className:'',html:h,iconSize:[s,s],iconAnchor:[s/2,s/2]})}).addTo(map)};
  } else {
   e.m.setLatLng([m.lat,m.lng]);
   if(e.h!==h){var s2=size(m.kind);e.h=h;e.m.setIcon(L.divIcon({className:'',html:h,iconSize:[s2,s2],iconAnchor:[s2/2,s2/2]}));}
  }
 });
 Object.keys(markers).forEach(function(id){if(!seen[id]){map.removeLayer(markers[id].m);delete markers[id];}});
 var r=st.route&&st.route.length>1?st.route.map(function(p){return[p.lat,p.lng]}):null;
 if(r){if(!line){line=L.polyline(r,{color:'#2F7BFF',weight:5,dashArray:'1 12',lineCap:'round'}).addTo(map);}else{line.setLatLngs(r);}}
 else if(line){map.removeLayer(line);line=null;}
 var pts=(st.markers||[]).map(function(m){return[m.lat,m.lng]});
 if(st.fit&&!fitted&&pts.length>1){map.fitBounds(pts,{padding:[60,60],maxZoom:17,animate:false});fitted=true;centered=true;}
 else if(!centered&&st.center){map.setView([st.center.lat,st.center.lng],st.zoom||15,{animate:false});centered=true;}
};
window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('ready');
</script></body></html>`;

export function LeafletMap({ center, zoom = 15, markers = [], route, fit, style }: Props) {
  const ref = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);
  const state = useMemo(() => JSON.stringify({ center, zoom, markers, route, fit }), [center, zoom, markers, route, fit]);
  const lastSent = useRef('');

  useEffect(() => {
    if (!ready || state === lastSent.current) return;
    lastSent.current = state;
    ref.current?.injectJavaScript(`window.najda && window.najda(${state}); true;`);
  }, [ready, state]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0D10' }, style]}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html: HTML, baseUrl: 'https://najda.app/' }}
        onMessage={(e: { nativeEvent: { data: string } }) => e.nativeEvent.data === 'ready' && setReady(true)}
        style={{ backgroundColor: '#0B0D10' }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        setBuiltInZoomControls={false}
        androidLayerType="hardware"
      />
    </View>
  );
}
