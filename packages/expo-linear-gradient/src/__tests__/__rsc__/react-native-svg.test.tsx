import React from 'react';

import Svg, {
    Circle,
    Ellipse,
    G,
    Text,
    TSpan,
    TextPath,
    Path,
    Polygon,
    Polyline,
    Line,
    Rect,
    Use,
    Image,
    Symbol,
    Defs,
    LinearGradient,
    RadialGradient,
    Stop,
    ClipPath,
    Pattern,
    Mask,
    Marker,
    ForeignObject,
    parse,
    SvgAst,
    SvgFromUri,
    SvgFromXml,
    SvgUri,
    SvgXml,
    camelCase,
    err,
    fetchText,
    Shape,
    RNSVGMarker,
    RNSVGMask,
    RNSVGPattern,
    RNSVGClipPath,
    RNSVGRadialGradient,
    RNSVGLinearGradient,
    RNSVGDefs,
    RNSVGSymbol,
    RNSVGImage,
    RNSVGUse,
    RNSVGTextPath,
    RNSVGTSpan,
    RNSVGText,
    RNSVGGroup,
    RNSVGPath,
    RNSVGLine,
    RNSVGEllipse,
    RNSVGCircle,
    RNSVGRect,
    RNSVGSvgAndroid,
    RNSVGSvgIOS,
    RNSVGForeignObject,

 } from 'react-native-svg'


// expo
// expo-status-bar
// @react-navigation/native
// @react-native-async-storage/async-storage
// expo-splash-screen
// react-native-reanimated
// react-native-svg
// expo-constants
// expo-font
// react-dom
// expo-linking
// expo-dev-client

Object.entries({
    Circle,
    Ellipse,
    G,
    Text,
    TSpan,
    TextPath,
    Path,
    Polygon,
    Polyline,
    Line,
    Rect,
    Use,
    Image,
    Symbol,
    Defs,
    LinearGradient,
    RadialGradient,
    Stop,
    ClipPath,
    Pattern,
    Mask,
    Marker,
    ForeignObject,
    // parse,
    SvgAst,
    SvgFromUri,
    SvgFromXml,
    SvgUri,
    SvgXml,
    // camelCase,
    // err,
    // fetchText,
    Shape,
    RNSVGMarker,
    RNSVGMask,
    RNSVGPattern,
    RNSVGClipPath,
    RNSVGRadialGradient,
    RNSVGLinearGradient,
    RNSVGDefs,
    RNSVGSymbol,
    RNSVGImage,
    RNSVGUse,
    RNSVGTextPath,
    RNSVGTSpan,
    RNSVGText,
    RNSVGGroup,
    RNSVGPath,
    RNSVGLine,
    RNSVGEllipse,
    RNSVGCircle,
    RNSVGRect,
    RNSVGSvgAndroid,
    RNSVGSvgIOS,
    RNSVGForeignObject,
//
}).forEach(([name, Component]) => {
  it(`renders ${name} to RSC`, async () => {
    const jsx = <Component />;

    await expect(jsx).toMatchFlightSnapshot();
  });
});
