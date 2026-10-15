package expo.modules.jetsonamultipath

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.ScanResult
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class JetsonaMultipathModule : Module() {
  private val main = Handler(Looper.getMainLooper())

  private val context: Context?
    get() = appContext.reactContext

  private val connectivityManager: ConnectivityManager?
    get() = context?.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

  private val wifiManager: WifiManager?
    get() = context?.applicationContext?.getSystemService(Context.WIFI_SERVICE) as? WifiManager

  private val telephonyManager: TelephonyManager?
    get() = context?.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager

  private var cellularCallback: ConnectivityManager.NetworkCallback? = null
  private var cellularNetwork: Network? = null
  private var cellularStatus: String = "disconnected"

  private var secondaryWifiCallback: ConnectivityManager.NetworkCallback? = null
  private var secondaryWifiNetwork: Network? = null
  private var secondaryWifiStatus: String = "disconnected"
  private var secondaryWifiSsid: String? = null

  override fun definition() = ModuleDefinition {
    Name("JetsonaMultipath")

    Events(
      "onMultipathStatusChanged",
      "onCellularStatusChanged",
      "onSecondaryWifiStatusChanged",
      "onWifiScanCompleted",
      "onCaptivePortalDetected"
    )

    OnDestroy {
      cleanup()
    }

    Function("getNetworkCapabilities") {
      mapOf(
        "hasCellular" to checkHasCellular(),
        "isDualWifiSupported" to checkIsDualWifiSupported(),
        "primaryWifi" to getPrimaryWifiInfo()
      )
    }

    Function("getAvailableWifiNetworks") {
      scanAvailableWifi()
    }

    Function("openCaptivePortalPage") {
      try {
        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("http://connectivitycheck.gstatic.com/generate_204"))
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        context?.startActivity(intent)
        true
      } catch (_: Exception) {
        false
      }
    }

    Function("enableCellularFallback") {
      startCellularFallback()
    }

    Function("disableCellularFallback") {
      stopCellularFallback()
    }

    Function("connectSecondaryWifi") { ssid: String, password: String? ->
      startConnectSecondaryWifi(ssid, password)
    }

    Function("disconnectSecondaryWifi") {
      stopSecondaryWifi()
    }

    Function("getCurrentMultipathStatus") {
      getMultipathStatus()
    }
  }

  private fun checkHasCellular(): Boolean {
    val cm = connectivityManager
    if (cm != null) {
      for (net in cm.allNetworks) {
        val caps = cm.getNetworkCapabilities(net)
        if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
          return true
        }
      }
    }
    val tm = telephonyManager ?: return false
    return try {
      val method = tm.javaClass.getMethod("isDataCapable")
      (method.invoke(tm) as? Boolean) ?: (tm.phoneType != TelephonyManager.PHONE_TYPE_NONE && tm.simState == TelephonyManager.SIM_STATE_READY)
    } catch (_: Exception) {
      tm.phoneType != TelephonyManager.PHONE_TYPE_NONE && tm.simState == TelephonyManager.SIM_STATE_READY
    }
  }

  private fun checkIsDualWifiSupported(): Boolean {
    val wm = wifiManager ?: return false
    return try {
      val method = wm.javaClass.getMethod("isStaStaConcurrencySupported")
      (method.invoke(wm) as? Boolean) ?: false
    } catch (_: Exception) {
      try {
        val methodAlt = wm.javaClass.getMethod("isDualBandSupported")
        (methodAlt.invoke(wm) as? Boolean) ?: false
      } catch (_: Exception) {
        false
      }
    }
  }

  private fun getPrimaryWifiInfo(): Map<String, Any?> {
    val wm = wifiManager ?: return emptyMap()
    val cm = connectivityManager ?: return emptyMap()
    val activeNet = cm.activeNetwork ?: return emptyMap()
    val caps = cm.getNetworkCapabilities(activeNet) ?: return emptyMap()

    if (!caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
      return emptyMap()
    }

    @Suppress("DEPRECATION")
    val info: WifiInfo? = wm.connectionInfo
    var rawSsid = info?.ssid ?: ""
    if (rawSsid.startsWith("\"") && rawSsid.endsWith("\"") && rawSsid.length >= 2) {
      rawSsid = rawSsid.substring(1, rawSsid.length - 1)
    }
    if (rawSsid == "<unknown ssid>") {
      rawSsid = "Wi-Fi Hiện Tại"
    }

    val freq = info?.frequency ?: 0
    val band = when {
      freq in 2400..2500 -> "2.4GHz"
      freq in 4900..5900 -> "5GHz"
      freq in 5925..7125 -> "6GHz"
      else -> if (freq > 0) "${freq}MHz" else "Wi-Fi"
    }

    return mapOf(
      "ssid" to rawSsid,
      "frequency" to freq,
      "band" to band,
      "linkSpeedMbps" to (info?.linkSpeed ?: 0),
      "rssi" to (info?.rssi ?: -100),
      "isHbsCapable" to (freq >= 5000)
    )
  }

  private fun scanAvailableWifi(): List<Map<String, Any?>> {
    val wm = wifiManager ?: return emptyList()

    try {
      @Suppress("DEPRECATION")
      wm.startScan()
    } catch (_: Exception) {}

    val results: List<ScanResult> = try {
      wm.scanResults ?: emptyList()
    } catch (_: Exception) {
      emptyList()
    }

    val unique = mutableMapOf<String, ScanResult>()
    for (res in results) {
      var ssid = res.SSID?.trim() ?: continue
      if (ssid.startsWith("\"") && ssid.endsWith("\"") && ssid.length >= 2) {
        ssid = ssid.substring(1, ssid.length - 1)
      }
      if (ssid.isEmpty() || ssid == "<unknown ssid>") continue
      val existing = unique[ssid]
      if (existing == null || res.level > existing.level) {
        unique[ssid] = res
      }
    }

    val primaryInfo = getPrimaryWifiInfo()
    val primarySsid = (primaryInfo["ssid"] as? String)?.trim() ?: ""

    val list = unique.values.map { item ->
      val freq = item.frequency
      val band = when {
        freq in 2400..2500 -> "2.4GHz"
        freq in 4900..5900 -> "5GHz"
        freq in 5925..7125 -> "6GHz"
        else -> "${freq}MHz"
      }
      var cleanSsid = item.SSID ?: ""
      if (cleanSsid.startsWith("\"") && cleanSsid.endsWith("\"") && cleanSsid.length >= 2) {
        cleanSsid = cleanSsid.substring(1, cleanSsid.length - 1)
      }
      mapOf(
        "ssid" to cleanSsid,
        "bssid" to (item.BSSID ?: ""),
        "frequency" to freq,
        "band" to band,
        "level" to item.level,
        "isHbsCandidate" to (freq >= 4900),
        "capabilities" to (item.capabilities ?: "")
      )
    }
    .filter {
      val s = (it["ssid"] as? String)?.trim() ?: ""
      s.isNotEmpty() && !s.equals(primarySsid, ignoreCase = true)
    }
    .sortedByDescending { (it["level"] as? Int) ?: -100 }.toMutableList()

    return list
  }

  private fun startCellularFallback(): Boolean {
    val cm = connectivityManager ?: return false
    stopCellularFallback()

    cellularStatus = "connecting"
    sendEvent("onCellularStatusChanged", mapOf("status" to cellularStatus))

    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()

    cellularCallback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        cellularNetwork = network
        cellularStatus = "connected"
        val payload = mapOf(
          "status" to "connected",
          "networkHandle" to network.networkHandle.toString(),
          "type" to "cellular"
        )
        sendEvent("onCellularStatusChanged", payload)
        emitMultipathStatus()
      }

      override fun onLost(network: Network) {
        if (cellularNetwork == network) {
          cellularNetwork = null
          cellularStatus = "disconnected"
          sendEvent("onCellularStatusChanged", mapOf("status" to "disconnected"))
          emitMultipathStatus()
        }
      }

      override fun onUnavailable() {
        cellularNetwork = null
        cellularStatus = "unavailable"
        sendEvent("onCellularStatusChanged", mapOf("status" to "unavailable"))
        emitMultipathStatus()
      }
    }

    try {
      cm.requestNetwork(request, cellularCallback!!)
      return true
    } catch (e: Exception) {
      cellularStatus = "error"
      sendEvent("onCellularStatusChanged", mapOf("status" to "error", "message" to (e.message ?: "")))
      return false
    }
  }

  private fun stopCellularFallback() {
    cellularCallback?.let {
      try {
        connectivityManager?.unregisterNetworkCallback(it)
      } catch (_: Exception) {}
      cellularCallback = null
    }
    cellularNetwork = null
    cellularStatus = "disconnected"
    sendEvent("onCellularStatusChanged", mapOf("status" to "disconnected"))
    emitMultipathStatus()
  }

  private fun startConnectSecondaryWifi(ssid: String, password: String?): Boolean {
    val cm = connectivityManager ?: return false
    stopSecondaryWifi()

    secondaryWifiSsid = ssid
    secondaryWifiStatus = "connecting"
    sendEvent("onSecondaryWifiStatusChanged", mapOf("status" to "connecting", "ssid" to ssid))

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      secondaryWifiStatus = "unavailable"
      sendEvent("onSecondaryWifiStatusChanged", mapOf("status" to "unavailable", "message" to "Yêu cầu Android 10 trở lên"))
      return false
    }

    val specifierBuilder = WifiNetworkSpecifier.Builder().setSsid(ssid)
    if (!password.isNullOrEmpty()) {
      specifierBuilder.setWpa2Passphrase(password)
    }

    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .setNetworkSpecifier(specifierBuilder.build())
      .build()

    secondaryWifiCallback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        secondaryWifiNetwork = network
        secondaryWifiStatus = "connected"
        val payload = mapOf(
          "status" to "connected",
          "ssid" to ssid,
          "networkHandle" to network.networkHandle.toString(),
          "type" to "wifi_secondary"
        )
        sendEvent("onSecondaryWifiStatusChanged", payload)
        emitMultipathStatus()
      }

      override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
        val hasCaptive = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL)
        if (hasCaptive) {
          sendEvent("onCaptivePortalDetected", mapOf("ssid" to ssid))
        }
      }

      override fun onLost(network: Network) {
        if (secondaryWifiNetwork == network) {
          secondaryWifiNetwork = null
          secondaryWifiStatus = "disconnected"
          sendEvent("onSecondaryWifiStatusChanged", mapOf("status" to "disconnected", "ssid" to ssid))
          emitMultipathStatus()
        }
      }

      override fun onUnavailable() {
        secondaryWifiNetwork = null
        secondaryWifiStatus = "unavailable"
        sendEvent("onSecondaryWifiStatusChanged", mapOf("status" to "unavailable", "ssid" to ssid))
        emitMultipathStatus()
      }
    }

    try {
      cm.requestNetwork(request, secondaryWifiCallback!!)
      return true
    } catch (e: Exception) {
      secondaryWifiStatus = "error"
      sendEvent("onSecondaryWifiStatusChanged", mapOf(
        "status" to "error",
        "ssid" to ssid,
        "message" to (e.message ?: "")
      ))
      return false
    }
  }

  private fun stopSecondaryWifi() {
    secondaryWifiCallback?.let {
      try {
        connectivityManager?.unregisterNetworkCallback(it)
      } catch (_: Exception) {}
      secondaryWifiCallback = null
    }
    secondaryWifiNetwork = null
    secondaryWifiStatus = "disconnected"
    val ssid = secondaryWifiSsid
    secondaryWifiSsid = null
    sendEvent("onSecondaryWifiStatusChanged", mapOf("status" to "disconnected", "ssid" to (ssid ?: "")))
    emitMultipathStatus()
  }

  private fun getMultipathStatus(): Map<String, Any?> {
    val primary = getPrimaryWifiInfo()
    val isSecondaryWifiActive = secondaryWifiStatus == "connected" && secondaryWifiNetwork != null
    val isCellularActive = cellularStatus == "connected" && cellularNetwork != null

    val isMultipathActive = isSecondaryWifiActive || isCellularActive

    val primaryBand = primary["band"] as? String ?: "Wi-Fi"
    val mode = when {
      isSecondaryWifiActive && primaryBand.contains("5GHz") -> "hbs_dual_wifi"
      isSecondaryWifiActive -> "dual_wifi"
      isCellularActive -> "wifi_cellular"
      else -> "single_wifi"
    }

    val secondary = when {
      isSecondaryWifiActive -> mapOf(
        "type" to "wifi",
        "ssid" to (secondaryWifiSsid ?: "Secondary Wi-Fi"),
        "status" to "connected"
      )
      isCellularActive -> mapOf(
        "type" to "cellular",
        "name" to "4G / 5G Cellular",
        "status" to "connected"
      )
      secondaryWifiStatus == "connecting" -> mapOf(
        "type" to "wifi",
        "ssid" to (secondaryWifiSsid ?: ""),
        "status" to "connecting"
      )
      cellularStatus == "connecting" -> mapOf(
        "type" to "cellular",
        "name" to "4G / 5G Cellular",
        "status" to "connecting"
      )
      else -> mapOf(
        "type" to "none",
        "status" to "disconnected"
      )
    }

    return mapOf(
      "isMultipathActive" to isMultipathActive,
      "mode" to mode,
      "primary" to primary,
      "secondary" to secondary
    )
  }

  private fun emitMultipathStatus() {
    main.post {
      sendEvent("onMultipathStatusChanged", getMultipathStatus())
    }
  }

  private fun cleanup() {
    stopCellularFallback()
    stopSecondaryWifi()
  }
}
