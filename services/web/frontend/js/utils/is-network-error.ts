const NETWORK_ERRORS = [
  // fetch
  'Failed to fetch',
  // fetch
  'NetworkError when attempting to fetch resource.',
  // download body
  'Load failed',
  // dns
  'A server with the specified hostname could not be found.',
  'Es wurde kein Server mit dem angegebenen Hostnamen gefunden.',
  'Impossibile trovare un server con il nome host specificato.',
  '未能找到使用指定主机名的服务器。',
  // offline
  'The Internet connection appears to be offline.',
  'Internetanslutningen verkar vara nedkopplad.',
  // connection error
  'Could not connect to the server.',
  'Impossible de se connecter au serveur.',
  'Verbindung zum Server konnte nicht hergestellt werden.',
  'Не удалось подключиться к серверу.',
  'يبدو أنه لا يوجد اتصال بالإنترنت.',
  '无法连接服务器。',
  // disconnected
  'The network connection was lost.',
  'A conexão de rede foi perdida.',
  'A hálózati kapcsolat megszakadt.',
  'A ligação de rede foi cortada.',
  'Ağ bağlantısı kesildi.',
  'Conexiunea de rețea a fost pierdută.',
  'De netwerkverbinding is verbroken.',
  'Die Netzwerkverbindung wurde unterbrochen.',
  'La conexión de red se ha perdido.',
  'La conexión de red se perdió.',
  'La connessione è stata persa.',
  'La connexion réseau a été perdue.',
  'La connexió de xarxa s’ha perdut.',
  'Mistet nettverksforbindelsen.',
  'Netværksforbindelsen gik tabt.',
  'Nätverksanslutningen förlorades.',
  'Połączenie sieciowe zostało przerwane.',
  'Veza s mrežom je prekinuta.',
  'la connessione è stata persa.',
  'Đã mất kết nối mạng.',
  'Сетевое соединение потеряно.',
  'החיבור לרשת אבד.',
  'تم فقدان اتصال الشبكة.',
  'キャンセルしました',
  'ネットワーク接続が切れました。',
  '已取消',
  '網絡連線中斷。',
  '網路連線中斷。',
  // slow network
  'The request timed out.',
  'Begäran nådde en maxtidsgräns.',
  'Esgotou-se o tempo limite da solicitação.',
  'Il tempo di attesa della richiesta è scaduto.',
  'La requête a expiré.',
  'Przekroczenie limitu czasu żądania.',
  'Se agotó el tiempo de espera.',
  'Se ha agotado el tiempo de espera.',
  'Tempo di richiesta scaduto.',
  'Temps esgotat per a la sol·licitud.',
  'Zeitüberschreitung bei der Anforderung.',
  'Превышен лимит времени на запрос.',
  'انتهت مهلة الطلب.',
  'データベースの要求が時間切れになりました。',
  '要求逾時。',
  '요청한 시간이 초과되었습니다.',
]

export function isNetworkError(err?: Error) {
  return err && NETWORK_ERRORS.includes(err.message)
}
