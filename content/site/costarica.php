<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
  <head>

    <meta http-equiv="imagetoolbar" content="false">
    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">

    <link rel="stylesheet" type="text/css" href="./CR/Tech/Style/MyCRStyle.css" />
    <LINK rel="SHORTCUT ICON" href="./CR/Tech/Image/logo.ico">

    <script language="JavaScript" type="text/javascript">
      var CurrentId = null;
     
 		function clickOnMenu(url,spanId) {
		
			if (CurrentId)
			{
			document.getElementById(CurrentId).style.backgroundColor = '';
			document.getElementById(CurrentId).style.paddingTop = '';
			document.getElementById(CurrentId).style.marginTop = '4px';
			}
			document.getElementById("iframe_content").src = url;
			document.getElementById(spanId).style.backgroundColor = 'olive';
			document.getElementById(spanId).style.paddingTop = '6px';
			document.getElementById(spanId).style.marginTop = '0px';
			CurrentId = spanId;
		}
   </script>
<script type="text/javascript">
  function goBack()
    {
    window.history.back()
    }
  function ShowPicture(name)
    {
          document.getElementById(name).src = "./CR/Tech/Image/back1.ico";
    }
  function HidePicture(name)
    {
          document.getElementById(name).src = "./CR/Tech/Image/back2.ico";
    }
</script>
</head>
<body>
  <table style="background-color:#009966; padding: 10px;">
    <tr>

		<td align="center">

			<span id="sp0" class="tab" onclick="clickOnMenu('./CostaRica/welcome.html','sp0')">Accueil</span>
			<span id="sp1" class="tab" onclick="clickOnMenu('./blogactu/index.php'),'sp1'">Actus</span>
			<span id="sp2" class="tab" onclick="clickOnMenu('./CostaRica/beurk.html','sp2')">Jour après jour</span>
			<span id="sp3" class="tab" onclick="clickOnMenu('./CostaRica/quid.html','sp3')">Notre projet</span> 
			<span id="sp4" class="tab" onclick="clickOnMenu('./CostaRica/faune.html','sp4')">Faune</span>
			<span id="sp5" class="tab" onclick="clickOnMenu('./CostaRica/flore.html','sp5')">Flore</span>
			<span id="sp6" class="tab" onclick="clickOnMenu('./CostaRica/bateau.html','sp6')">Bateau</span>

		</td>

    </tr>

	<tr>
	<td width="100%" height="590"><iframe id="iframe_content" frameborder="0" src="./CostaRica/welcome.html" width="100%" height="100%"></iframe></td>
	</tr>

   <tr>
	<td>
		<a class="rubrique" href="./index.html" width="140" target="_top">Home</a>
	</td>
	<td>
            <p class="std">26856 visites</p>
	</td>
  </tr>
</table>
<script type="text/javascript">
var gaJsHost = (("https:" == document.location.protocol) ? "https://ssl." : "http://www.");
document.write(unescape("%3Cscript src='" + gaJsHost + "google-analytics.com/ga.js' type='text/javascript'%3E%3C/script%3E"));
</script>
<script type="text/javascript">
try {
var pageTracker = _gat._getTracker("UA-8029555-2");
pageTracker._trackPageview();
} catch(err) {}</script>
</body>
</html>
